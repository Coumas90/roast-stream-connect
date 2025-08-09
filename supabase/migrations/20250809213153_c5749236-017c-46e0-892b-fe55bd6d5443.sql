-- Fix linter issues introduced by previous migration

-- 1) Restore set_updated_at with explicit search_path
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2) Add explicit restrictive RLS policies for pos_credentials
-- Allow only platform admins to read; no write access via direct SQL (functions will use SECURITY DEFINER)
create policy if not exists pos_credentials_select_admin_only
on public.pos_credentials
for select
using (public.is_tupa_admin());

create policy if not exists pos_credentials_write_admin_only
on public.pos_credentials
for all
using (public.is_tupa_admin())
with check (public.is_tupa_admin());