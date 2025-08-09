
-- 1) Invitaciones con token firmado (hash) + expiración + RLS + RPC de aceptación

-- Tabla de invitaciones
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  email text not null,
  role public.app_role not null,
  token_hash text not null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invitations enable row level security;

-- set updated_at
create trigger set_invitations_updated_at
before update on public.invitations
for each row execute function public.set_updated_at();

-- Políticas
create policy invitations_select_by_tenant
on public.invitations
for select
to authenticated
using (public.user_has_tenant(tenant_id));

create policy invitations_insert_admin_only
on public.invitations
for insert
to authenticated
with check (public.is_tupa_admin());

create policy invitations_update_admin_only
on public.invitations
for update
to authenticated
using (public.is_tupa_admin())
with check (public.is_tupa_admin());

create policy invitations_delete_admin_only
on public.invitations
for delete
to authenticated
using (public.is_tupa_admin());

-- Únicas para evitar duplicar invitaciones abiertas
create unique index if not exists invitations_unique_open_tenant_email_role
on public.invitations(tenant_id, email, role)
where location_id is null and accepted_at is null;

create unique index if not exists invitations_unique_open_tenant_location_email_role
on public.invitations(tenant_id, location_id, email, role)
where location_id is not null and accepted_at is null;

-- Función para aceptar invitación (usa SECURITY DEFINER)
create or replace function public.accept_invitation(_token text)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_inv public.invitations%rowtype;
  v_hash text;
  v_email text;
  v_tenant_slug text;
  v_location_code text;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  -- Usar la extensión 'pgcrypto' ubicada en el schema 'extensions' en Supabase
  v_hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  select i.*
    into v_inv
  from public.invitations i
  where i.token_hash = v_hash
    and i.accepted_at is null
    and i.expires_at > now()
  limit 1;

  if not found then
    raise exception 'invalid or expired token';
  end if;

  -- comprobar email del usuario actual
  select u.email into v_email
  from auth.users u
  where u.id = auth.uid();

  if v_email is null or v_email <> v_inv.email then
    raise exception 'email mismatch';
  end if;

  -- obtener identificadores de texto requeridos por assign_role_by_email
  select t.slug into v_tenant_slug from public.tenants t where t.id = v_inv.tenant_id;
  select l.code into v_location_code from public.locations l where l.id = v_inv.location_id;

  -- asignar rol en el alcance del tenant/location correspondiente
  perform public.assign_role_by_email(v_inv.email, v_inv.role, v_tenant_slug, v_location_code);

  -- marcar invitación como aceptada
  update public.invitations
     set accepted_at = now(),
         accepted_by = auth.uid()
   where id = v_inv.id;
end;
$$;

-- Realtime opcional
alter table public.invitations replica identity full;
alter publication supabase_realtime add table public.invitations;

-- 2) Auditoría para futuras impersonaciones (solo admin)
create table if not exists public.impersonation_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.impersonation_logs enable row level security;

create policy impersonation_logs_select_admin
on public.impersonation_logs
for select
to authenticated
using (public.is_tupa_admin());

create policy impersonation_logs_insert_admin
on public.impersonation_logs
for insert
to authenticated
with check (public.is_tupa_admin());

-- 3) Unicidad de slug en tenants (sin forzar NOT NULL a nivel de columna)
create unique index if not exists tenants_slug_unique_notnull
on public.tenants(slug)
where slug is not null;

-- 4) Realtime recomendado (si no estaba) para integraciones/entitlements
alter table public.pos_integrations replica identity full;
alter publication supabase_realtime add table public.pos_integrations;

alter table public.entitlements replica identity full;
alter publication supabase_realtime add table public.entitlements;
