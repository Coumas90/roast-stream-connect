-- POS sync structures (idempotent)
-- Schemas: public

-- 1) Products table
create table if not exists public.pos_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  location_id uuid not null,
  provider public.app_pos_provider not null,
  external_id text not null,
  name text,
  sku text,
  price numeric,
  updated_at timestamptz not null default now(),
  inserted_at timestamptz not null default now()
);

-- Unique idempotent constraint
alter table public.pos_products
  add constraint if not exists pos_products_uniq_location_provider_external
  unique (location_id, provider, external_id);

-- Useful indexes
create index if not exists idx_pos_products_location on public.pos_products(location_id);
create index if not exists idx_pos_products_tenant on public.pos_products(tenant_id);

-- Enable RLS and policy (read by location access)
alter table public.pos_products enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pos_products' and policyname = 'pos_products_select_by_location'
  ) then
    create policy pos_products_select_by_location
      on public.pos_products for select
      using (public.user_has_location(location_id));
  end if;
end $$;

-- updated_at trigger
do $$ begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'update_pos_products_updated_at'
      and tgrelid = 'public.pos_products'::regclass
  ) then
    create trigger update_pos_products_updated_at
    before update on public.pos_products
    for each row execute function public.set_updated_at();
  end if;
end $$;


-- 2) Orders table
create table if not exists public.pos_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  location_id uuid not null,
  provider public.app_pos_provider not null,
  external_id text not null,
  total numeric,
  status text,
  occurred_at timestamptz not null,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pos_orders
  add constraint if not exists pos_orders_uniq_location_provider_external
  unique (location_id, provider, external_id);

create index if not exists idx_pos_orders_location_occurred_at on public.pos_orders(location_id, occurred_at);
create index if not exists idx_pos_orders_tenant on public.pos_orders(tenant_id);

alter table public.pos_orders enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pos_orders' and policyname = 'pos_orders_select_by_location'
  ) then
    create policy pos_orders_select_by_location
      on public.pos_orders for select
      using (public.user_has_location(location_id));
  end if;
end $$;

-- updated_at trigger

do $$ begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'update_pos_orders_updated_at'
      and tgrelid = 'public.pos_orders'::regclass
  ) then
    create trigger update_pos_orders_updated_at
    before update on public.pos_orders
    for each row execute function public.set_updated_at();
  end if;
end $$;


-- 3) Sync runs table
create table if not exists public.pos_sync_runs (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null,
  provider public.app_pos_provider not null,
  kind text not null check (kind in ('products','orders')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean not null default false,
  error text,
  items integer not null default 0
);

create index if not exists idx_pos_sync_runs_location_kind_started on public.pos_sync_runs(location_id, kind, started_at desc);

alter table public.pos_sync_runs enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pos_sync_runs' and policyname = 'pos_sync_runs_select_by_location'
  ) then
    create policy pos_sync_runs_select_by_location
      on public.pos_sync_runs for select
      using (public.user_has_location(location_id));
  end if;
end $$;
