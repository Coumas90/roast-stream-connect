-- Restore set_updated_at with explicit search_path (already done above, harmless if re-run)
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

-- Add restrictive RLS policies for pos_credentials
drop policy if exists pos_credentials_select_admin_only on public.pos_credentials;
drop policy if exists pos_credentials_write_admin_only on public.pos_credentials;

create policy pos_credentials_select_admin_only
on public.pos_credentials
for select
using (public.is_tupa_admin());

create policy pos_credentials_write_admin_only
on public.pos_credentials
for all
using (public.is_tupa_admin())
with check (public.is_tupa_admin());