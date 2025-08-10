-- Qualify pgcrypto functions to avoid search_path issues
-- Ensure all invitation-related functions call extensions.gen_random_bytes and extensions.digest explicitly

-- accept_invitation
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_inv public.invitations%rowtype;
  v_user_id uuid;
  v_email text;
  v_hash text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  v_user_id := auth.uid();
  v_email := (auth.jwt() ->> 'email');
  if v_email is null then
    raise exception 'email not found in token';
  end if;

  v_hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  select * into v_inv
  from public.invitations i
  where i.token_hash = v_hash
    and (i.expires_at is null or i.expires_at > now())
    and i.accepted_at is null
  limit 1;

  if not found then
    raise exception 'invalid or expired invitation';
  end if;

  if lower(v_inv.email) <> lower(v_email) then
    raise exception 'invitation email mismatch';
  end if;

  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_user_id
      and ur.role = v_inv.role
      and ur.tenant_id = v_inv.tenant_id
      and ur.location_id is not distinct from v_inv.location_id
  ) then
    insert into public.user_roles(user_id, role, tenant_id, location_id)
    values (v_user_id, v_inv.role, v_inv.tenant_id, v_inv.location_id);
  end if;

  update public.invitations
  set accepted_at = now(),
      accepted_by = v_user_id
  where id = v_inv.id;

  perform public.log_invitation_event('accepted', v_inv.id, v_email, v_inv.tenant_id, jsonb_build_object('role', v_inv.role, 'location_id', v_inv.location_id));
end;
$function$;

-- rotate_invitation_token
CREATE OR REPLACE FUNCTION public.rotate_invitation_token(_invitation_id uuid, _expires_in_minutes integer DEFAULT 10080)
RETURNS TABLE(id uuid, token text, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_inv public.invitations%rowtype;
  v_inviter uuid;
  v_token text;
  v_hash text;
  v_expires_at timestamptz;
begin
  v_inviter := auth.uid();
  if v_inviter is null then
    raise exception 'authentication required';
  end if;

  select * into v_inv from public.invitations where id = _invitation_id;
  if not found then
    raise exception 'invitation not found';
  end if;

  if v_inv.accepted_at is not null then
    raise exception 'already accepted';
  end if;

  if not public.user_has_location(v_inv.location_id) then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_inviter
      and ur.role in ('owner'::public.app_role, 'manager'::public.app_role)
      and (ur.location_id = v_inv.location_id or ur.tenant_id = v_inv.tenant_id)
  ) then
    raise exception 'insufficient privileges';
  end if;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + make_interval(mins => _expires_in_minutes);

  update public.invitations
  set token_hash = v_hash,
      expires_at = v_expires_at,
      updated_at = now()
  where id = _invitation_id;

  perform public.log_invitation_event('resent', _invitation_id, v_inv.email, v_inv.tenant_id, jsonb_build_object('role', v_inv.role, 'location_id', v_inv.location_id));

  return query select _invitation_id, v_token, v_expires_at;
end;
$function$;

-- create_location_invitation
CREATE OR REPLACE FUNCTION public.create_location_invitation(_email text, _role app_role, _location_id uuid, _expires_in_minutes integer DEFAULT 10080)
RETURNS TABLE(id uuid, token text, email text, role app_role, tenant_id uuid, location_id uuid, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_tenant uuid;
  v_inviter uuid;
  v_is_owner boolean;
  v_is_manager boolean;
  v_allowed boolean;
  v_token text;
  v_hash text;
  v_expires_at timestamptz;
  v_id uuid;
begin
  v_inviter := auth.uid();
  if v_inviter is null then
    raise exception 'authentication required';
  end if;

  select l.tenant_id into v_tenant
  from public.locations l
  where l.id = _location_id;
  if v_tenant is null then
    raise exception 'invalid location';
  end if;

  if not public.user_has_location(_location_id) then
    raise exception 'forbidden';
  end if;

  select exists(
    select 1 from public.user_roles ur
    where ur.user_id = v_inviter
      and ur.role = 'owner'::public.app_role
      and (ur.location_id = _location_id or ur.tenant_id = v_tenant)
  ) into v_is_owner;

  select exists(
    select 1 from public.user_roles ur
    where ur.user_id = v_inviter
      and ur.role = 'manager'::public.app_role
      and (ur.location_id = _location_id or ur.tenant_id = v_tenant)
  ) into v_is_manager;

  if not (v_is_owner or v_is_manager) then
    raise exception 'insufficient privileges';
  end if;

  v_allowed := case
    when v_is_owner then _role in ('manager'::public.app_role, 'coffee_master'::public.app_role, 'barista'::public.app_role)
    when v_is_manager then _role in ('coffee_master'::public.app_role, 'barista'::public.app_role)
    else false
  end;

  if not v_allowed then
    raise exception 'role not allowed';
  end if;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + make_interval(mins => _expires_in_minutes);

  delete from public.invitations i
  where i.tenant_id = v_tenant
    and i.location_id = _location_id
    and lower(i.email) = lower(_email)
    and i.accepted_at is null;

  insert into public.invitations (id, token_hash, tenant_id, location_id, email, role, expires_at, created_by)
  values (gen_random_uuid(), v_hash, v_tenant, _location_id, lower(_email), _role, v_expires_at, v_inviter)
  returning id into v_id;

  perform public.log_invitation_event('created', v_id, lower(_email), v_tenant, jsonb_build_object('role', _role, 'location_id', _location_id));

  return query
  select v_id, v_token, lower(_email), _role, v_tenant, _location_id, v_expires_at;
end;
$function$;

-- revoke_invitation
CREATE OR REPLACE FUNCTION public.revoke_invitation(_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_inv public.invitations%rowtype;
  v_inviter uuid;
  v_scramble text;
begin
  v_inviter := auth.uid();
  if v_inviter is null then
    raise exception 'authentication required';
  end if;

  select * into v_inv from public.invitations where id = _invitation_id;
  if not found then
    raise exception 'invitation not found';
  end if;

  if not public.user_has_location(v_inv.location_id) then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_inviter
      and ur.role in ('owner'::public.app_role, 'manager'::public.app_role)
      and (ur.location_id = v_inv.location_id or ur.tenant_id = v_inv.tenant_id)
  ) then
    raise exception 'insufficient privileges';
  end if;

  v_scramble := encode(extensions.gen_random_bytes(16), 'hex');

  update public.invitations
  set token_hash = encode(extensions.digest(v_scramble, 'sha256'), 'hex'),
      updated_at = now(),
      expires_at = now() - interval '1 minute'
  where id = _invitation_id;

  perform public.log_invitation_event('revoked', _invitation_id, v_inv.email, v_inv.tenant_id, jsonb_build_object('role', v_inv.role, 'location_id', v_inv.location_id));
end;
$function$;