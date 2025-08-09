
-- Otorgar rol de 'tupa_admin' a comasnicolas+100@gmail.com (idempotente)
with u as (
  select id from auth.users where email = 'comasnicolas+100@gmail.com' limit 1
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
