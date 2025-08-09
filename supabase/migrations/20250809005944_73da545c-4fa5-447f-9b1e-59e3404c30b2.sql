-- Fix: re-apply migration without IF NOT EXISTS on CREATE POLICY
create extension if not exists pgcrypto;

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'owner',
  token_hash text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz null,
  created_by uuid null
);

create unique index if not exists invitations_token_hash_key on public.invitations(token_hash);
create unique index if not exists invitations_unique_open on public.invitations(tenant_id, email, role)
  where accepted_at is null;

-- Recreate trigger safely
drop trigger if exists trg_invitations_set_updated_at on public.invitations;
create trigger trg_invitations_set_updated_at
before update on public.invitations
for each row execute function public.set_updated_at();

alter table public.invitations enable row level security;

-- Recreate policies safely
drop policy if exists invitations_select_admin_only on public.invitations;
drop policy if exists invitations_write_admin_only on public.invitations;

create policy invitations_select_admin_only
on public.invitations for select
using (public.is_tupa_admin());

create policy invitations_write_admin_only
on public.invitations for all
using (public.is_tupa_admin())
with check (public.is_tupa_admin());

-- Accept invitation RPC
create or replace function public.accept_invitation(_token text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_inv public.invitations%rowtype;
  v_user_id uuid;
  v_email text;
  v_hash text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  v_user_id := auth.uid();
  v_email := (auth.jwt() ->> 'email');
  if v_email is null then
    raise exception 'email not found in token';
  end if;

  v_hash := encode(digest(_token, 'sha256'), 'hex');

  select * into v_inv
  from public.invitations i
  where i.token_hash = v_hash
    and (i.expires_at is null or i.expires_at > now())
    and i.accepted_at is null
  limit 1;

  if not found then
    raise exception 'invalid or expired invitation';
  end if;

  if lower(v_inv.email) <> lower(v_email) then
    raise exception 'invitation email mismatch';
  end if;

  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_user_id
      and ur.role = v_inv.role
      and ur.tenant_id = v_inv.tenant_id
      and ur.location_id is null
  ) then
    insert into public.user_roles(user_id, role, tenant_id, location_id)
    values (v_user_id, v_inv.role, v_inv.tenant_id, null);
  end if;

  update public.invitations set accepted_at = now() where id = v_inv.id;
end;
$$;