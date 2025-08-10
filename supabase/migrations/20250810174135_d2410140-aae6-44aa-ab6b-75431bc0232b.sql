
-- 1) Restringir el helper: solo Owner/Manager tienen acceso tenant-wide; los demás solo por location exacta
create or replace function public.user_has_location(_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_tupa_admin()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.location_id = _location_id
    )
    or exists (
      select 1
      from public.user_roles ur
      join public.locations l on l.id = _location_id
      where ur.user_id = auth.uid()
        and ur.tenant_id = l.tenant_id
        and ur.role in ('owner'::public.app_role, 'manager'::public.app_role)
    )
$$;

-- 2) Asegurar que la tabla invitations emite eventos de realtime (para refrescar la UI de MyTeam)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'invitations'
  ) then
    alter publication supabase_realtime add table public.invitations;
  end if;
end $$;
