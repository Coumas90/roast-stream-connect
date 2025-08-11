
-- =========================================================
-- POS Sync Logger - Ajustes 2.2 (idempotentes)
-- - pos_sync_status (provider enum, índices, RLS SELECT only)
-- - pos_sync_runs: crear SOLO si no existe (provider enum)
-- - índices adicionales
-- - trigger set_updated_at si existe la función
-- =========================================================

-- 1) Tabla pos_sync_status (si no existe), con provider = enum
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

-- Habilitar RLS
alter table public.pos_sync_status enable row level security;

-- Política de SELECT segura (solo una vez)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pos_sync_status'
      and policyname = 'pos_sync_status_select_by_access'
  ) then
    create policy pos_sync_status_select_by_access
      on public.pos_sync_status
      for select
      using (
        public.is_tupa_admin()
        or public.user_has_location(location_id)
      );
  end if;
end $$;

-- NO crear políticas de INSERT/UPDATE/DELETE: escrituras vía service_role o RPC SD.

-- Índices útiles
create index if not exists pos_sync_status_next_attempt_at_idx
  on public.pos_sync_status (next_attempt_at);
create index if not exists pos_sync_status_paused_until_idx
  on public.pos_sync_status (paused_until);

-- 2) Tabla pos_sync_runs: crear SOLO si no existe (con provider enum)
do $$
begin
  if to_regclass('public.pos_sync_runs') is null then
    create table public.pos_sync_runs (
      id uuid primary key default gen_random_uuid(),
      client_id uuid null,
      location_id uuid not null,
      provider public.app_pos_provider not null,
      status text not null check (status in ('running','success','error')),
      attempt int not null default 1,
      started_at timestamptz not null default now(),
      finished_at timestamptz null,
      duration_ms int null,
      count int not null default 0,
      error text null,
      meta jsonb not null default '{}'::jsonb
    );

    -- RLS + política de SELECT
    alter table public.pos_sync_runs enable row level security;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'pos_sync_runs'
        and policyname = 'pos_sync_runs_select_by_access'
    ) then
      create policy pos_sync_runs_select_by_access
        on public.pos_sync_runs
        for select
        using (public.is_tupa_admin() or public.user_has_location(location_id));
    end if;

    -- NO crear políticas de INSERT/UPDATE/DELETE aquí.
  end if;
end $$;

-- Índice compuesto recomendado para listados recientes por par (si existe la tabla)
do $$
begin
  if to_regclass('public.pos_sync_runs') is not null then
    create index if not exists pos_sync_runs_loc_prov_started_desc_idx
      on public.pos_sync_runs(location_id, provider, started_at desc);
  end if;
end $$;

-- 3) Triggers updated_at (solo si existe la función)
do $$
begin
  if exists (
    select 1 from pg_proc
    where proname = 'set_updated_at'
    and pg_function_is_visible(oid)
  ) then
    -- pos_sync_status
    if to_regclass('public.pos_sync_status') is not null then
      drop trigger if exists set_updated_at_pos_sync_status on public.pos_sync_status;
      create trigger set_updated_at_pos_sync_status
      before update on public.pos_sync_status
      for each row execute function public.set_updated_at();
    end if;

    -- pos_sync_runs: sólo si la tabla tiene updated_at (no alteramos si ya existía sin esa columna)
    if to_regclass('public.pos_sync_runs') is not null
       and exists (select 1 from information_schema.columns
                   where table_schema='public' and table_name='pos_sync_runs' and column_name='updated_at') then
      drop trigger if exists set_updated_at_pos_sync_runs on public.pos_sync_runs;
      create trigger set_updated_at_pos_sync_runs
      before update on public.pos_sync_runs
      for each row execute function public.set_updated_at();
    end if;
  end if;
end $$;

-- 4) Nota: si pos_sync_runs ya existía con otro esquema (ok/items), no se modifica.
--    Las escrituras se harán vía service_role o RPC SD que adapten la lógica según el esquema disponible.
