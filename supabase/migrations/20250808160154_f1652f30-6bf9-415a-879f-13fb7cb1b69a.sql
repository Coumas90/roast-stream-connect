
begin;

-- 1) Drop insecure demo policies (idempotent: only if they exist)
drop policy if exists "tenants_select_demo" on public.tenants;
drop policy if exists "locations_select_demo" on public.locations;
drop policy if exists "pos_select_demo" on public.pos_integrations;
drop policy if exists "pos_update_demo" on public.pos_integrations;
drop policy if exists "orders_select_demo" on public.order_proposals;
drop policy if exists "orders_insert_demo" on public.order_proposals;
drop policy if exists "orders_update_demo" on public.order_proposals;

-- 2) Reseed secure demo tenant and related data

-- Tenant
insert into public.tenants (name, slug)
select 'TUPÁ Demo', 'tupa-demo'
where not exists (select 1 from public.tenants where slug = 'tupa-demo');

-- Locations for demo tenant with timezone
with t as (
  select id from public.tenants where slug = 'tupa-demo'
)
insert into public.locations (tenant_id, name, code, timezone)
select t.id, v.name, v.code, 'America/Argentina/Buenos_Aires'
from t
cross join (values ('Palermo','PAL'),('Caballito','CAB')) as v(name, code)
where not exists (
  select 1 from public.locations l where l.tenant_id = t.id and l.name = v.name
);

-- Entitlements per location
with t as (
  select id from public.tenants where slug = 'tupa-demo'
),
locs as (
  select l.id as location_id, t.id as tenant_id
  from public.locations l
  join t on true
)
insert into public.entitlements (tenant_id, location_id)
select tenant_id, location_id from locs
where not exists (
  select 1 from public.entitlements e
  where e.tenant_id = locs.tenant_id and e.location_id = locs.location_id
);

-- POS integration (Odoo, disconnected)
with t as (
  select id from public.tenants where slug = 'tupa-demo'
)
insert into public.pos_integrations (tenant_id, provider, connected, metadata)
select t.id, 'odoo', false, '{}'::jsonb
from t
where not exists (
  select 1 from public.pos_integrations p where p.tenant_id = t.id and p.provider = 'odoo'
);

-- One sample order proposal in draft (no pending/active flow)
with l as (
  select id as location_id, tenant_id
  from public.locations
  where name = 'Palermo'
)
insert into public.order_proposals (tenant_id, location_id, items, source, status)
select l.tenant_id, l.location_id, '[{"code":"ESP1KG","qty":2}]'::jsonb, 'manual', 'draft'
from l
where not exists (
  select 1 from public.order_proposals o where o.tenant_id = l.tenant_id
);

-- 3) Minimum indexes
create index if not exists idx_consumption_daily_loc_day
  on public.consumption_daily(location_id, day);

create index if not exists idx_order_proposals_loc_status
  on public.order_proposals(location_id, status);

create index if not exists idx_user_roles_u_t_l
  on public.user_roles(user_id, tenant_id, location_id);

-- 4) Safe helpers to assign/revoke roles by email (no service key exposure)
--    SECURITY DEFINER + runtime admin check; explicit schema qualification for auth.users.

create or replace function public.assign_role_by_email(
  _email text,
  _role public.app_role,
  _tenant_slug text default null,
  _location_code text default null
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_user uuid;
  v_tenant uuid;
  v_location uuid;
begin
  -- Allow only platform admins to assign roles
  if not public.is_tupa_admin() then
    raise exception 'only tupa_admin can assign roles';
  end if;

  select u.id into v_user
  from auth.users u
  where u.email = _email
  limit 1;

  if v_user is null then
    raise exception 'user with email % not found', _email;
  end if;

  if _tenant_slug is not null then
    select t.id into v_tenant
    from public.tenants t
    where t.slug = _tenant_slug
    limit 1;

    if v_tenant is null then
      raise exception 'tenant with slug % not found', _tenant_slug;
    end if;
  end if;

  if _location_code is not null then
    select l.id into v_location
    from public.locations l
    where l.code = _location_code
      and (v_tenant is null or l.tenant_id = v_tenant)
    limit 1;

    if v_location is null then
      raise exception 'location with code % not found (and/or not under tenant %)', _location_code, _tenant_slug;
    end if;
  end if;

  -- insert only if not already present (no unique constraint required)
  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_user
      and ur.role = _role
      and ur.tenant_id is not distinct from v_tenant
      and ur.location_id is not distinct from v_location
  ) then
    insert into public.user_roles(user_id, role, tenant_id, location_id)
    values (v_user, _role, v_tenant, v_location);
  end if;
end;
$$;

create or replace function public.revoke_role_by_email(
  _email text,
  _role public.app_role,
  _tenant_slug text default null,
  _location_code text default null
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_user uuid;
  v_tenant uuid;
  v_location uuid;
begin
  if not public.is_tupa_admin() then
    raise exception 'only tupa_admin can revoke roles';
  end if;

  select u.id into v_user
  from auth.users u
  where u.email = _email
  limit 1;

  if v_user is null then
    raise exception 'user with email % not found', _email;
  end if;

  if _tenant_slug is not null then
    select t.id into v_tenant
    from public.tenants t
    where t.slug = _tenant_slug
    limit 1;
  end if;

  if _location_code is not null then
    select l.id into v_location
    from public.locations l
    where l.code = _location_code
      and (v_tenant is null or l.tenant_id = v_tenant)
    limit 1;
  end if;

  delete from public.user_roles ur
  where ur.user_id = v_user
    and ur.role = _role
    and ur.tenant_id is not distinct from v_tenant
    and ur.location_id is not distinct from v_location;
end;
$$;

-- 5) Seed test roles for your email
--    Note: these direct inserts run as migration (superuser), do not require the helper.

-- 5.1) Make the provided email a global tupa_admin
with u as (
  select id from auth.users where email = 'comasnicolas@gmail.com' limit 1
)
insert into public.user_roles(user_id, role)
select u.id, 'tupa_admin'::public.app_role from u
where u.id is not null
  and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = u.id and ur.role = 'tupa_admin'::public.app_role
  );

-- 5.2) Make the same user the owner of the demo tenant
with u as (
  select id from auth.users where email = 'comasnicolas@gmail.com' limit 1
),
t as (
  select id from public.tenants where slug = 'tupa-demo' limit 1
)
insert into public.user_roles(user_id, role, tenant_id)
select u.id, 'owner'::public.app_role, t.id
from u, t
where u.id is not null and t.id is not null
  and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = u.id and ur.role = 'owner'::public.app_role and ur.tenant_id = t.id
  );

-- Optional examples (commented): add manager for Palermo and barista for Caballito
-- Uncomment and change email(s) if you want to assign to different users.
-- select public.assign_role_by_email('comasnicolas@gmail.com', 'manager', 'tupa-demo', 'PAL');
-- select public.assign_role_by_email('comasnicolas@gmail.com', 'barista', 'tupa-demo', 'CAB');

commit;
