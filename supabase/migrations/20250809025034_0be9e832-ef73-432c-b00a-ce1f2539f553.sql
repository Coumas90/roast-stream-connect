-- Invitations improvements: location scoping, security guards, indices, triggers, RPCs, and realtime

-- 1) Columns
alter table public.invitations
  add column if not exists location_id uuid,
  add column if not exists accepted_by uuid;

-- 2) Foreign key for location_id (only if missing). Avoid FKs to auth.users per best practices.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invitations_location_id_fkey'
  ) THEN
    ALTER TABLE public.invitations
      ADD CONSTRAINT invitations_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Triggers: updated_at and email normalization
create or replace function public.normalize_email()
returns trigger
language plpgsql
as $$
begin
  if new.email is not null then
    new.email := lower(new.email);
  end if;
  return new;
end;
$$;

drop trigger if exists invitations_normalize_email on public.invitations;
create trigger invitations_normalize_email
before insert or update on public.invitations
for each row execute function public.normalize_email();

-- updated_at trigger (uses existing public.set_updated_at())
drop trigger if exists set_invitations_updated_at on public.invitations;
create trigger set_invitations_updated_at
before update on public.invitations
for each row execute function public.set_updated_at();

-- 4) Indices
create unique index if not exists invitations_token_hash_key on public.invitations (token_hash);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'invitations_pending_unique'
  ) THEN
    EXECUTE 'create unique index invitations_pending_unique
             on public.invitations (tenant_id, location_id, email)
             where accepted_at is null and expires_at > now()';
  END IF;
END $$;

-- 5) Realtime configuration (safe if already present)
alter table public.invitations replica identity full;
alter table public.user_roles replica identity full;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication p
    JOIN pg_publication_rel pr ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'invitations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.invitations;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication p
    JOIN pg_publication_rel pr ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'user_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
  END IF;
END $$;

-- 6) RPCs

-- 6.1 list_location_invitations with access guard
create or replace function public.list_location_invitations(_location_id uuid)
returns table (
  id uuid,
  email text,
  role public.app_role,
  tenant_id uuid,
  location_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_by uuid
)
language plpgsql
security definer
set search_path = 'public, extensions'
as $$
begin
  if not public.user_has_location(_location_id) then
    raise exception 'forbidden';
  end if;

  return query
  select i.id, i.email, i.role, i.tenant_id, i.location_id, i.created_at, i.updated_at, i.expires_at, i.accepted_at, i.created_by
  from public.invitations i
  where i.location_id = _location_id
    and i.accepted_at is null
    and i.expires_at > now()
  order by i.created_at desc;
end;
$$;

-- 6.2 create_location_invitation with anti-escalation
create or replace function public.create_location_invitation(
  _email text,
  _role public.app_role,
  _location_id uuid,
  _expires_in_minutes integer default 10080
)
returns table (
  id uuid,
  token text,
  email text,
  role public.app_role,
  tenant_id uuid,
  location_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = 'public, extensions'
as $$
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

  -- inviter roles
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

  -- anti-escalation
  v_allowed := case
    when v_is_owner then _role in ('manager'::public.app_role, 'coffee_master'::public.app_role, 'barista'::public.app_role)
    when v_is_manager then _role in ('coffee_master'::public.app_role, 'barista'::public.app_role)
    else false
  end;

  if not v_allowed then
    raise exception 'role not allowed';
  end if;

  -- Generate token
  v_token := encode(gen_random_bytes(16), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + make_interval(mins => _expires_in_minutes);

  -- Ensure only one pending invitation per email/location
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
$$;

-- 6.3 rotate_invitation_token (returns new token)
create or replace function public.rotate_invitation_token(_invitation_id uuid, _expires_in_minutes integer default 10080)
returns table (id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = 'public, extensions'
as $$
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

  v_token := encode(gen_random_bytes(16), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + make_interval(mins => _expires_in_minutes);

  update public.invitations
  set token_hash = v_hash,
      expires_at = v_expires_at,
      updated_at = now()
  where id = _invitation_id;

  perform public.log_invitation_event('resent', _invitation_id, v_inv.email, v_inv.tenant_id, jsonb_build_object('role', v_inv.role, 'location_id', v_inv.location_id));

  return query select _invitation_id, v_token, v_expires_at;
end;
$$;

-- 6.4 revoke_invitation
create or replace function public.revoke_invitation(_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public, extensions'
as $$
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

  v_scramble := encode(gen_random_bytes(16), 'hex');

  update public.invitations
  set token_hash = encode(digest(v_scramble, 'sha256'), 'hex'),
      updated_at = now(),
      expires_at = now() - interval '1 minute'
  where id = _invitation_id;

  perform public.log_invitation_event('revoked', _invitation_id, v_inv.email, v_inv.tenant_id, jsonb_build_object('role', v_inv.role, 'location_id', v_inv.location_id));
end;
$$;

-- 6.5 accept_invitation: location-aware and record accepted_by
create or replace function public.accept_invitation(_token text)
returns void
language plpgsql
security definer
set search_path = 'public, extensions'
as $$
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

  v_hash := encode(digest(_token, 'sha256'), 'hex');

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
$$;

-- 7) Grants for RPCs
grant execute on function public.list_location_invitations(uuid) to authenticated;
grant execute on function public.create_location_invitation(text, public.app_role, uuid, integer) to authenticated;
grant execute on function public.rotate_invitation_token(uuid, integer) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
