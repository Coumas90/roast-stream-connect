-- Enable http extension if needed (not strictly used in stub)
-- We won't call HTTP from SQL for now; edge validation is a stub and validation happens logically here.

-- 1) Secure table for POS credentials
create table if not exists public.pos_credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  provider public.app_pos_provider not null,
  secret_ref text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pos_credentials_exactly_one_scope check ((tenant_id is not null) <> (location_id is not null))
);

-- Ensure uniqueness per scope
create unique index if not exists ux_pos_credentials_location_provider
  on public.pos_credentials(location_id, provider)
  where location_id is not null;

create unique index if not exists ux_pos_credentials_tenant_provider
  on public.pos_credentials(tenant_id, provider)
  where tenant_id is not null;

-- RLS: deny all by default (no policies)
alter table public.pos_credentials enable row level security;

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_pos_credentials_updated_at
before update on public.pos_credentials
for each row execute function public.set_updated_at();

-- 2) RPC to connect POS at location scope
create or replace function public.connect_pos_location(
  _location_id uuid,
  _provider public.app_pos_provider,
  _api_key text
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tenant uuid;
  v_allowed boolean;
  v_secret_ref text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select l.tenant_id into v_tenant from public.locations l where l.id = _location_id;
  if v_tenant is null then
    raise exception 'invalid location';
  end if;

  -- Authorization: platform admin OR (has access to location AND role owner/manager)
  v_allowed := public.is_tupa_admin() or (
    public.user_has_location(_location_id) and (
      public.has_role(auth.uid(), 'owner'::public.app_role) or public.has_role(auth.uid(), 'manager'::public.app_role)
    )
  );
  if not v_allowed then
    raise exception 'forbidden';
  end if;

  -- TEMP validation stub: require non-empty api key; real validation delegated to Edge Function
  if _api_key is null or length(trim(_api_key)) = 0 then
    raise exception 'API key inválida o vacía';
  end if;

  -- Build a secret reference (actual secret to be stored in secure vault/kv by backend)
  v_secret_ref := 'pos/location/' || _location_id::text || '/' || _provider::text;

  -- Upsert credentials (location scope)
  insert into public.pos_credentials(id, tenant_id, location_id, provider, secret_ref)
  values (gen_random_uuid(), v_tenant, _location_id, _provider, v_secret_ref)
  on conflict (location_id, provider)
  where _location_id is not null
  do update set secret_ref = excluded.secret_ref, updated_at = now();

  -- Connect effective provider at location
  perform public.set_pos_location(_location_id, _provider, true, '{}'::jsonb);
end;
$$;

-- Allow authenticated users to execute (function enforces authorization)
grant execute on function public.connect_pos_location(uuid, public.app_pos_provider, text) to authenticated;