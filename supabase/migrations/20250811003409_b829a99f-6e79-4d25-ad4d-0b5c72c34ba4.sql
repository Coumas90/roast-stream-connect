
-- 1) Función segura para listar miembros de una sucursal
create or replace function public.list_location_members(_location_id uuid)
returns table(
  user_id uuid,
  role public.app_role,
  tenant_id uuid,
  location_id uuid,
  created_at timestamptz,
  full_name text,
  email text
)
language sql
security definer
set search_path = public
as $$
  select
    ur.user_id,
    ur.role,
    ur.tenant_id,
    ur.location_id,
    ur.created_at,
    p.full_name,
    au.email
  from public.user_roles ur
  left join public.profiles p on p.id = ur.user_id
  left join auth.users au on au.id = ur.user_id
  where ur.location_id = _location_id
    and (
      public.is_tupa_admin()
      or public.user_has_location(_location_id)
    )
  order by ur.created_at asc
$$;

-- 2) Realtime para user_roles (para que MyTeam se refresque al aceptar invitaciones)
alter table public.user_roles replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_roles'
  ) then
    alter publication supabase_realtime add table public.user_roles;
  end if;
end $$;
