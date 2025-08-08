
-- ================================================
-- TUPÁ Hub - Fase 2 (MVP DB + RLS)
-- Núcleo multi-tenant, roles, operaciones y estado POS
-- ================================================

-- 1) Tipos (enums)
create type public.app_role as enum ('tupa_admin','owner','manager','coffee_master','barista');

create type public.stock_txn_type as enum ('receipt','consumption','adjustment');

create type public.order_status as enum ('draft','approved','sent','fulfilled','cancelled');

-- 2) Tablas base: tenants y locations
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  code text,
  timezone text,
  created_at timestamptz not null default now()
);

-- 3) Profiles (vinculado a auth.users) y trigger on signup
create table public.profiles (
  id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  default_tenant_id uuid references public.tenants(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

-- Inserta un profile al crear un usuario (Google/email)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), null)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4) Roles por usuario/tenant/location
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role, tenant_id, location_id),
  check (
    (role = 'tupa_admin' and tenant_id is null and location_id is null)
    or (role <> 'tupa_admin' and tenant_id is not null)
  )
);

-- 5) Entitlements por tenant/location
create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  loyalty_enabled boolean not null default false,
  raffles_enabled boolean not null default false,
  pos_connected boolean not null default false,
  auto_order_enabled boolean not null default false,
  academy_enabled boolean not null default false,
  barista_pool_enabled boolean not null default false,
  barista_tool_enabled boolean not null default false,
  qa_franchise_enabled boolean not null default false,
  mystery_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, location_id)
);

create trigger entitlements_set_updated_at
before update on public.entitlements
for each row execute procedure public.set_updated_at();

-- 6) Recipes (globales - tenant_id null - o por tenant)
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  method text,
  params jsonb,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger recipes_set_updated_at
before update on public.recipes
for each row execute procedure public.set_updated_at();

-- 7) Consumo y stock (inserciones futuras vía Edge Functions)
create table public.consumption_daily (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  day date not null,
  item_code text,
  cups integer,
  grams_used numeric,
  created_at timestamptz not null default now(),
  unique (location_id, day, item_code)
);

create table public.stock_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  txn_type public.stock_txn_type not null,
  item_code text not null,
  quantity_grams numeric not null,
  notes text
);

-- 8) Order Proposals (crea /app, gestiona /admin)
create table public.order_proposals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  status public.order_status not null default 'draft',
  proposed_at timestamptz not null default now(),
  items jsonb not null,
  created_by uuid references auth.users(id),
  source text not null default 'manual',
  odoo_so_number text
);

-- 9) POS Integrations
create table public.pos_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  connected boolean not null default false,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider)
);
create trigger pos_integrations_set_updated_at
before update on public.pos_integrations
for each row execute procedure public.set_updated_at();

-- ================================================
-- RLS helpers (Security definer functions)
-- ================================================
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = _role
  );
$$;

create or replace function public.is_tupa_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'tupa_admin');
$$;

create or replace function public.user_has_tenant(_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and (ur.tenant_id = _tenant_id)
  ) or public.is_tupa_admin();
$$;

create or replace function public.user_has_location(_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Acceso directo por location o por pertenencia al tenant de esa location
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and (ur.location_id = _location_id
           or ur.tenant_id = (select l.tenant_id from public.locations l where l.id = _location_id)
      )
  ) or public.is_tupa_admin();
$$;

-- ================================================
-- RLS (Row Level Security) y políticas
-- ================================================
alter table public.tenants enable row level security;
alter table public.locations enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.entitlements enable row level security;
alter table public.recipes enable row level security;
alter table public.consumption_daily enable row level security;
alter table public.stock_ledger enable row level security;
alter table public.order_proposals enable row level security;
alter table public.pos_integrations enable row level security;

-- tenants
create policy "tenants_select_by_access"
  on public.tenants for select
  using (public.user_has_tenant(id));

create policy "tenants_admin_write"
  on public.tenants for all
  using (public.is_tupa_admin())
  with check (public.is_tupa_admin());

-- locations
create policy "locations_select_by_access"
  on public.locations for select
  using (public.user_has_location(id));

create policy "locations_admin_write"
  on public.locations for all
  using (public.is_tupa_admin())
  with check (public.is_tupa_admin());

-- profiles
create policy "profiles_select_self_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_tupa_admin());

create policy "profiles_insert_self"
  on public.profiles for insert
  with check (id = auth.uid() or public.is_tupa_admin());

create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid() or public.is_tupa_admin())
  with check (id = auth.uid() or public.is_tupa_admin());

-- user_roles
create policy "user_roles_select_self_or_admin"
  on public.user_roles for select
  using (user_id = auth.uid() or public.is_tupa_admin());

create policy "user_roles_admin_write"
  on public.user_roles for all
  using (public.is_tupa_admin())
  with check (public.is_tupa_admin());

-- entitlements
create policy "entitlements_select_by_tenant"
  on public.entitlements for select
  using (public.user_has_tenant(tenant_id));

create policy "entitlements_write_admin_only"
  on public.entitlements for all
  using (public.is_tupa_admin())
  with check (public.is_tupa_admin());

-- recipes
create policy "recipes_select_global_or_tenant"
  on public.recipes for select
  using ((tenant_id is null) or public.user_has_tenant(tenant_id));

-- Crear/editar recetas: admin o owner del tenant
create policy "recipes_insert_admin_or_owner"
  on public.recipes for insert
  with check (
    public.is_tupa_admin()
    or (tenant_id is not null and public.user_has_tenant(tenant_id) and public.has_role(auth.uid(), 'owner'))
  );

create policy "recipes_update_admin_or_owner"
  on public.recipes for update
  using (
    public.is_tupa_admin()
    or (tenant_id is not null and public.user_has_tenant(tenant_id) and public.has_role(auth.uid(), 'owner'))
  )
  with check (
    public.is_tupa_admin()
    or (tenant_id is not null and public.user_has_tenant(tenant_id) and public.has_role(auth.uid(), 'owner'))
  );

-- consumption_daily (solo lectura para quienes tienen acceso; inserciones las harán funciones/servicio)
create policy "consumption_select_by_location"
  on public.consumption_daily for select
  using (public.user_has_location(location_id));

-- stock_ledger (solo lectura por ahora)
create policy "stock_select_by_location"
  on public.stock_ledger for select
  using (public.user_has_location(location_id));

-- order_proposals
create policy "orders_select_by_location"
  on public.order_proposals for select
  using (public.user_has_location(location_id));

-- Insert desde /app (cualquier rol con acceso a esa location)
create policy "orders_insert_by_location_access"
  on public.order_proposals for insert
  with check (public.user_has_location(location_id));

-- Update (p.ej. status) por admin o owner del tenant
create policy "orders_update_admin_or_owner"
  on public.order_proposals for update
  using (
    public.is_tupa_admin()
    or (public.user_has_tenant(tenant_id) and public.has_role(auth.uid(), 'owner'))
  )
  with check (
    public.is_tupa_admin()
    or (public.user_has_tenant(tenant_id) and public.has_role(auth.uid(), 'owner'))
  );

-- pos_integrations
create policy "pos_select_by_tenant_access"
  on public.pos_integrations for select
  using (public.user_has_tenant(tenant_id));

-- update por admin o owner del tenant
create policy "pos_update_admin_or_owner"
  on public.pos_integrations for update
  using (
    public.is_tupa_admin()
    or (public.user_has_tenant(tenant_id) and public.has_role(auth.uid(), 'owner'))
  )
  with check (
    public.is_tupa_admin()
    or (public.user_has_tenant(tenant_id) and public.has_role(auth.uid(), 'owner'))
  );

-- ================================================
-- Realtime (para order_proposals en la cola)
-- ================================================
alter table public.order_proposals replica identity full;
alter publication supabase_realtime add table public.order_proposals;

-- ================================================
-- Listo
-- ================================================
