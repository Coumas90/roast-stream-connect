-- POS Sync Logger migration (idempotent)
-- - Creates pos_sync_status if missing
-- - Ensures pos_sync_runs exists and has required columns
-- - Uses enum app_pos_provider for provider
-- - Enables RLS with SELECT-only policies
-- - Adds useful indexes
-- - Adds set_updated_at trigger if function exists

-- 0) Ensure enum app_pos_provider exists (assumed existing in this project). We won't create it here to avoid conflicts.
--    If not present, this migration will error; the project already defines it.

-- 1) Create table pos_sync_status if not exists (using enum for provider)
create table if not exists public.pos_sync_status (
  location_id uuid not null,
  provider public.app_pos_provider not null,
  consecutive_failures integer not null default 0,
  last_run_at timestamptz null,
  last_error text null,
  next_attempt_at timestamptz null,
  paused_until timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(location_id, provider)
);

-- 1.a) If provider ended up as text in an older install, convert it to enum safely
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pos_sync_status'
      and column_name='provider' and udt_name='text'
  ) then
    alter table public.pos_sync_status
    alter column provider type public.app_pos_provider using provider::public.app_pos_provider;
  end if;
end $$;

-- 1.b) Indexes for pos_sync_status
-- PK already provides (location_id, provider), but we add explicit composite index only if useful
create index if not exists ix_pos_sync_status_next_attempt_at on public.pos_sync_status(next_attempt_at);
create index if not exists ix_pos_sync_status_location_provider on public.pos_sync_status(location_id, provider);

-- 1.c) RLS and policies (SELECT-only)
alter table public.pos_sync_status enable row level security;
-- Drop existing policies with same names to avoid duplicates
do $$
begin
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='pos_sync_status' and policyname='pos_sync_status_select_by_access'
  ) then
    drop policy "pos_sync_status_select_by_access" on public.pos_sync_status;
  end if;
end $$;

create policy "pos_sync_status_select_by_access"
  on public.pos_sync_status
  for select
  using (public.is_tupa_admin() or public.user_has_location(location_id));

-- No INSERT/UPDATE/DELETE policies on purpose: writes go via service_role/RPC only

-- 1.d) Trigger for updated_at if function exists
do $$
begin
  if exists (select 1 from pg_proc where proname='set_updated_at' and pg_function_is_visible(oid)) then
    if not exists (select 1 from pg_trigger where tgname='trg_pos_sync_status_set_updated_at') then
      create trigger trg_pos_sync_status_set_updated_at
      before update on public.pos_sync_status
      for each row execute function public.set_updated_at();
    end if;
  end if;
end $$;

-- 2) Ensure table pos_sync_runs exists (superset schema compatible with logger and existing readers)
create table if not exists public.pos_sync_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid null,
  location_id uuid not null,
  provider public.app_pos_provider not null,
  -- status-based fields for logger
  status text null check (status in ('running','success','error')),
  attempt integer not null default 1,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  duration_ms integer null,
  count integer not null default 0,
  error text null,
  meta jsonb not null default '{}'::jsonb,
  -- legacy fields kept for compatibility with older readers
  kind text null,
  ok boolean not null default false,
  items integer not null default 0
);

-- 2.a) If table existed with differing column types or missing columns, align them idempotently
-- Make provider enum if it was text
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pos_sync_runs'
      and column_name='provider' and udt_name='text'
  ) then
    alter table public.pos_sync_runs
    alter column provider type public.app_pos_provider using provider::public.app_pos_provider;
  end if;
end $$;

-- Add any missing columns
alter table public.pos_sync_runs
  add column if not exists client_id uuid,
  add column if not exists status text,
  add column if not exists attempt integer default 1,
  add column if not exists duration_ms integer,
  add column if not exists count integer default 0,
  add column if not exists error text,
  add column if not exists meta jsonb default '{}'::jsonb,
  add column if not exists kind text,
  add column if not exists ok boolean default false,
  add column if not exists items integer default 0;

-- Constrain status values if column exists but without constraint
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pos_sync_runs' and column_name='status'
  ) and not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname='pos_sync_runs' and c.conname='pos_sync_runs_status_chk'
  ) then
    alter table public.pos_sync_runs
    add constraint pos_sync_runs_status_chk check (status in ('running','success','error'));
  end if;
end $$;

-- 2.b) Indexes for quick listing by pair and time
create index if not exists ix_pos_sync_runs_loc_prov_started_at on public.pos_sync_runs(location_id, provider, started_at desc);
-- Legacy separate indexes (kept if already exist, otherwise optional)
create index if not exists ix_pos_sync_runs_provider on public.pos_sync_runs(provider);
create index if not exists ix_pos_sync_runs_location on public.pos_sync_runs(location_id);

-- 2.c) RLS and SELECT-only policy
alter table public.pos_sync_runs enable row level security;
-- Replace existing policy name to keep idempotency
do $$
begin
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='pos_sync_runs' and policyname='pos_sync_runs_select_by_access'
  ) then
    drop policy "pos_sync_runs_select_by_access" on public.pos_sync_runs;
  end if;
end $$;

create policy "pos_sync_runs_select_by_access"
  on public.pos_sync_runs
  for select
  using (public.is_tupa_admin() or public.user_has_location(location_id));

-- No INSERT/UPDATE/DELETE policies: writes are done via service_role/RPC only

-- 2.d) Trigger updated_at if function exists (add column if missing)
alter table public.pos_sync_runs add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (select 1 from pg_proc where proname='set_updated_at' and pg_function_is_visible(oid)) then
    if not exists (select 1 from pg_trigger where tgname='trg_pos_sync_runs_set_updated_at') then
      create trigger trg_pos_sync_runs_set_updated_at
      before update on public.pos_sync_runs
      for each row execute function public.set_updated_at();
    end if;
  end if;
end $$;
