
-- Asignar rol de admin (tupa_admin) al usuario comasnicolas@gmail.com
-- Seguro de ejecutar múltiples veces: no duplica filas.
with u as (
  select id from auth.users where email = 'comasnicolas@gmail.com' limit 1
)
insert into public.user_roles (user_id, role)
select u.id, 'tupa_admin'::public.app_role
from u
where u.id is not null
  and not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = u.id
      and ur.role = 'tupa_admin'::public.app_role
  );
