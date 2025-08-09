-- pos_logs table for observability
create table if not exists public.pos_logs (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  tenant_id uuid,
  location_id uuid,
  provider public.app_pos_provider,
  scope text not null,
  level text not null check (level in ('debug','info','warn','error')),
  message text not null,
  meta jsonb not null default '{}'::jsonb
);

-- Indexes to query recent errors and by location/provider
create index if not exists idx_pos_logs_ts on public.pos_logs(ts desc);
create index if not exists idx_pos_logs_location_ts on public.pos_logs(location_id, ts desc);
create index if not exists idx_pos_logs_provider_ts on public.pos_logs(provider, ts desc);
create index if not exists idx_pos_logs_level_ts on public.pos_logs(level, ts desc);

-- Enable RLS and read policies for authorized users
alter table public.pos_logs enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='pos_logs' and policyname='pos_logs_select_by_access'
  ) then
    create policy pos_logs_select_by_access
      on public.pos_logs for select
      using (
        public.is_tupa_admin()
        or (tenant_id is not null and public.user_has_tenant(tenant_id))
        or (location_id is not null and public.user_has_location(location_id))
      );
  end if;
end $$;