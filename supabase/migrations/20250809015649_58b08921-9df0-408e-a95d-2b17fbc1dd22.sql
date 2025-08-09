-- 1) Audit table for invitations
create table if not exists public.invitation_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event text not null check (event in ('sent','accepted','revoked')),
  invitation_id uuid,
  email text,
  tenant_id uuid,
  metadata jsonb
);

alter table public.invitation_audit enable row level security;

-- RLS: readable by platform admins only (create if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invitation_audit' AND policyname = 'invitation_audit_select_admin'
  ) THEN
    CREATE POLICY invitation_audit_select_admin
    ON public.invitation_audit
    FOR SELECT
    USING (public.is_tupa_admin());
  END IF;
END $$;

-- 2) Helper function to log audit events
create or replace function public.log_invitation_event(_event text, _invitation_id uuid, _email text, _tenant_id uuid, _metadata jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.invitation_audit(event, invitation_id, email, tenant_id, metadata)
  values (_event, _invitation_id, lower(_email), _tenant_id, _metadata);
$$;

-- 3) Update accept_invitation to log acceptance
create or replace function public.accept_invitation(_token text)
 returns void
 language plpgsql
 security definer
 set search_path TO 'public, extensions'
as $function$
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

  -- audit
  perform public.log_invitation_event('accepted', v_inv.id, v_email, v_inv.tenant_id, jsonb_build_object('role', v_inv.role));
end;
$function$;

-- 4) Optional index to query audit by tenant/time
create index if not exists idx_inv_audit_tenant_time on public.invitation_audit(tenant_id, created_at desc);
