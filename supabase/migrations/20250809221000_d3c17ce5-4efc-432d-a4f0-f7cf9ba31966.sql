-- Update policy to allow platform admins to read sync runs
do $$ begin
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='pos_sync_runs' and policyname='pos_sync_runs_select_by_location'
  ) then
    drop policy pos_sync_runs_select_by_location on public.pos_sync_runs;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='pos_sync_runs' and policyname='pos_sync_runs_select_by_access'
  ) then
    create policy pos_sync_runs_select_by_access
      on public.pos_sync_runs for select
      using (public.is_tupa_admin() or public.user_has_location(location_id));
  end if;
end $$;