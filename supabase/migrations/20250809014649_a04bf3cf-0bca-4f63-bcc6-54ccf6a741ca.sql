
-- 1) Extensiones necesarias
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- 2) Endurecer invitations: índices y normalización
create unique index if not exists invitations_token_hash_key on public.invitations(token_hash);
create index if not exists invitations_email_active_idx
  on public.invitations (lower(email))
  where accepted_at is null;

-- Trigger para normalizar email a minúsculas
create or replace function public.normalize_invitation_email()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.email is not null then
    new.email := lower(new.email);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invitations_normalize_email on public.invitations;
create trigger trg_invitations_normalize_email
  before insert or update of email on public.invitations
  for each row execute function public.normalize_invitation_email();

-- Asegurar updated_at en updates
drop trigger if exists trg_invitations_set_updated_at on public.invitations;
create trigger trg_invitations_set_updated_at
  before update on public.invitations
  for each row execute function public.set_updated_at();

-- 3) accept_invitation con search_path ampliado para digest()
create or replace function public.accept_invitation(_token text)
returns void
language plpgsql
security definer
set search_path to 'public, extensions'
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
end;
$function$;

-- 4) RLS invitations: SELECT por tenant (evita filtraciones entre tenants)
drop policy if exists "invitations_select_admin_only" on public.invitations;
create policy "invitations_select_by_tenant"
  on public.invitations
  for select
  using (public.user_has_tenant(tenant_id));

-- Mantener escritura SOLO para tupa_admin (ya existe 'invitations_write_admin_only')

-- 5) Limpieza automática de expiradas
create or replace function public.cleanup_expired_invitations()
returns void
language sql
security definer
set search_path to 'public'
as $$
  delete from public.invitations
  where accepted_at is null
    and expires_at < now();
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-expired-invitations-daily') then
    perform cron.unschedule('cleanup-expired-invitations-daily');
  end if;
  perform cron.schedule(
    'cleanup-expired-invitations-daily',
    '0 3 * * *',
    $$select public.cleanup_expired_invitations();$$
  );
end$$;
