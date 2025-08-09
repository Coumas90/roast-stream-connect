
-- 1) Tipos y auditoría: formalizar eventos y evitar choque
do $$
begin
  if not exists (select 1 from pg_type where typname = 'invitation_event') then
    create type public.invitation_event as enum ('sent','resent','accepted','revoked');
  end if;
end$$;

-- Dropear cualquier CHECK previo en invitation_audit para el campo event
do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'invitation_audit'
      and c.contype = 'c'
  loop
    execute format('alter table public.invitation_audit drop constraint %I', r.conname);
  end loop;
end$$;

-- Cambiar el tipo de event a enum
alter table public.invitation_audit
  alter column event type public.invitation_event
  using event::public.invitation_event;

-- log_invitation_event ahora recibe invitation_event
create or replace function public.log_invitation_event(
  _event public.invitation_event,
  _invitation_id uuid,
  _email text,
  _tenant_id uuid,
  _metadata jsonb default '{}'::jsonb
) returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into public.invitation_audit(event, invitation_id, email, tenant_id, metadata)
  values (_event, _invitation_id, lower(_email), _tenant_id, _metadata);
$$;

-- 2) Invitations: accepted_by, normalización de email, de-dup parcial
alter table public.invitations
  add column if not exists accepted_by uuid;

-- FK opcional (no modifica schemas reservados; solo referencia)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invitations_accepted_by_fkey'
  ) then
    alter table public.invitations
      add constraint invitations_accepted_by_fkey
      foreign key (accepted_by) references auth.users(id) on delete set null;
  end if;
end$$;

-- Trigger para normalizar email a lower()
create or replace function public.invitations_normalize_email()
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

drop trigger if exists tr_invitations_normalize_email on public.invitations;
create trigger tr_invitations_normalize_email
before insert or update on public.invitations
for each row execute function public.invitations_normalize_email();

-- Índice único parcial: una invitación pendiente por combinación (tenant, location, email, role)
create unique index if not exists invitations_unique_pending_email_role_loc
on public.invitations (tenant_id, location_id, lower(email), role)
where accepted_at is null;

-- Índice para búsquedas por token_hash
create index if not exists invitations_token_hash_idx
on public.invitations (token_hash);

-- 3) RPC crear invitación por sucursal (scope + guardas de rol + 7 días + audit "sent")
create or replace function public.create_location_invitation(
  _email text,
  _role public.app_role,
  _location_id uuid
)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path to 'public, extensions'
as $$
declare
  v_tenant uuid;
  v_token text;
  v_hash text;
  v_expires timestamptz;
  inviter_is_owner boolean;
  inviter_is_manager boolean;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select l.tenant_id into v_tenant
  from public.locations l
  where l.id = _location_id
  limit 1;

  if v_tenant is null then
    raise exception 'location not found';
  end if;

  if not public.user_has_location(_location_id) then
    raise exception 'forbidden';
  end if;

  inviter_is_owner := exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'owner'::public.app_role
      and (ur.tenant_id = v_tenant or ur.location_id = _location_id)
  );

  inviter_is_manager := exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'manager'::public.app_role
      and (ur.tenant_id = v_tenant or ur.location_id = _location_id)
  );

  if inviter_is_owner then
    if _role not in ('manager'::public.app_role, 'coffee_master'::public.app_role, 'barista'::public.app_role) then
      raise exception 'owner can only invite manager, coffee_master or barista';
    end if;
  elsif inviter_is_manager then
    if _role not in ('coffee_master'::public.app_role, 'barista'::public.app_role) then
      raise exception 'manager can only invite coffee_master or barista';
    end if;
  else
    raise exception 'forbidden';
  end if;

  v_token := replace(replace(encode(gen_random_bytes(32), 'base64'), '+','-'), '/','_');
  v_token := regexp_replace(v_token, '=+$', '');
  v_expires := now() + interval '7 days';
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.invitations (tenant_id, location_id, role, email, token_hash, expires_at, created_by)
  values (v_tenant, _location_id, _role, lower(_email), v_hash, v_expires, auth.uid())
  returning id, v_token, v_expires into invitation_id, token, expires_at;

  perform public.log_invitation_event('sent'::public.invitation_event, invitation_id, lower(_email), v_tenant, jsonb_build_object('role', _role, 'location_id', _location_id));

  return;
exception
  when unique_violation then
    raise exception 'pending invitation already exists for this email/role/location';
end;
$$;

-- 4) RPC rotar token (Resend) con audit "resent"
create or replace function public.rotate_invitation_token(
  _invitation_id uuid
)
returns table (token text, expires_at timestamptz)
language plpgsql
security definer
set search_path to 'public, extensions'
as $$
declare
  v_inv public.invitations%rowtype;
  v_token text;
  v_hash text;
  v_expires timestamptz;
begin
  select * into v_inv from public.invitations where id = _invitation_id limit 1;
  if not found then
    raise exception 'invitation not found';
  end if;

  if v_inv.accepted_at is not null then
    raise exception 'cannot rotate token for accepted invitation';
  end if;

  if not public.user_has_location(v_inv.location_id) then
    raise exception 'forbidden';
  end if;

  if not (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'owner'::public.app_role and (ur.tenant_id = v_inv.tenant_id or ur.location_id = v_inv.location_id))
    or
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'manager'::public.app_role and (ur.tenant_id = v_inv.tenant_id or ur.location_id = v_inv.location_id))
  ) then
    raise exception 'forbidden';
  end if;

  v_token := replace(replace(encode(gen_random_bytes(32), 'base64'), '+','-'), '/','_');
  v_token := regexp_replace(v_token, '=+$', '');
  v_expires := now() + interval '7 days';
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  update public.invitations
  set token_hash = v_hash, expires_at = v_expires, updated_at = now()
  where id = _invitation_id;

  perform public.log_invitation_event('resent'::public.invitation_event, _invitation_id, v_inv.email, v_inv.tenant_id, jsonb_build_object('role', v_inv.role, 'location_id', v_inv.location_id));

  token := v_token; expires_at := v_expires;
  return;
end;
$$;

-- 5) RPC revocar invitación (expira y rota hash) con audit "revoked"
create or replace function public.revoke_invitation(
  _invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public, extensions'
as $$
declare
  v_inv public.invitations%rowtype;
  v_token text;
  v_hash text;
begin
  select * into v_inv from public.invitations where id = _invitation_id limit 1;
  if not found then
    raise exception 'invitation not found';
  end if;

  if not public.user_has_location(v_inv.location_id) then
    raise exception 'forbidden';
  end if;

  if not (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'owner'::public.app_role and (ur.tenant_id = v_inv.tenant_id or ur.location_id = v_inv.location_id))
    or
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'manager'::public.app_role and (ur.tenant_id = v_inv.tenant_id or ur.location_id = v_inv.location_id))
  ) then
    raise exception 'forbidden';
  end if;

  v_token := replace(replace(encode(gen_random_bytes(32), 'base64'), '+','-'), '/','_');
  v_token := regexp_replace(v_token, '=+$', '');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  update public.invitations
  set expires_at = now(), token_hash = v_hash, updated_at = now()
  where id = _invitation_id and accepted_at is null;

  perform public.log_invitation_event('revoked'::public.invitation_event, _invitation_id, v_inv.email, v_inv.tenant_id, jsonb_build_object('role', v_inv.role, 'location_id', v_inv.location_id));
end;
$$;

-- 6) Aceptación: scope por location cuando exista, accepted_by y audit
create or replace function public.accept_invitation(_token text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public, extensions'
as $function$
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

  if v_inv.location_id is not null then
    if not exists (
      select 1 from public.user_roles ur
      where ur.user_id = v_user_id
        and ur.role = v_inv.role
        and ur.tenant_id = v_inv.tenant_id
        and ur.location_id = v_inv.location_id
    ) then
      insert into public.user_roles(user_id, role, tenant_id, location_id)
      values (v_user_id, v_inv.role, v_inv.tenant_id, v_inv.location_id);
    end if;
  else
    if not exists (
      select 1 from public.user_roles ur
      where ur.user_id = v_user_id
        and ur.role = v_inv.role
        and ur.tenant_id = v_inv.tenant_id
        and ur.location_id is null
    ) then
      insert into public.user_roles(user_id, role, tenant_id, location_id)
      values (v_user_id, v_inv.role, v_inv.tenant_id, null);
    end if;
  end if;

  update public.invitations
  set accepted_at = now(), accepted_by = v_user_id
  where id = v_inv.id;

  perform public.log_invitation_event('accepted'::public.invitation_event, v_inv.id, v_email, v_inv.tenant_id, jsonb_build_object('role', v_inv.role, 'location_id', v_inv.location_id));
end;
$function$;

-- 7) Realtime: replica identity y publicación condicional
alter table public.invitations replica identity full;
alter table public.user_roles replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'invitations'
  ) then
    execute 'alter publication supabase_realtime add table public.invitations';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_roles'
  ) then
    execute 'alter publication supabase_realtime add table public.user_roles';
  end if;
end$$;
