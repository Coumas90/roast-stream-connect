-- =========================================================
-- POS Provider Credentials (cifrado + API pública segura)
-- Idempotente
-- =========================================================

-- 1) Tabla base (solo ciphertext + metadatos)
create table if not exists public.pos_provider_credentials (
  location_id uuid not null,
  provider public.app_pos_provider not null,
  ciphertext text not null,                     -- JSON AES-GCM {iv, tag, data} base64
  masked_hints jsonb not null default '{}'::jsonb, -- ej: {"apiKeyEnd":"…c3d4"}
  status text not null default 'pending' check (status in ('pending','connected','invalid')),
  last_verified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (location_id, provider)
);

-- 1.a) Si la columna provider quedó como text en alguna instalación vieja, convertirla a enum
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pos_provider_credentials'
      and column_name='provider' and udt_name='text'
  ) then
    alter table public.pos_provider_credentials
      alter column provider type public.app_pos_provider
      using provider::public.app_pos_provider;
  end if;
end $$;

-- 2) RLS: habilitar y NO crear políticas de SELECT (bloquea lecturas directas)
alter table public.pos_provider_credentials enable row level security;

-- 3) Trigger updated_at si existe la función
do $$
begin
  if exists (select 1 from pg_proc where proname='set_updated_at' and pg_function_is_visible(oid)) then
    drop trigger if exists set_updated_at_pos_provider_credentials on public.pos_provider_credentials;
    create trigger set_updated_at_pos_provider_credentials
    before update on public.pos_provider_credentials
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- 4) Función pública segura (SECURITY DEFINER) que devuelve SOLO columnas seguras
create or replace function public.pos_provider_credentials_public(_location_id uuid)
returns table(
  location_id uuid,
  provider public.app_pos_provider,
  masked_hints jsonb,
  status text,
  last_verified_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    c.location_id,
    c.provider,
    c.masked_hints,
    c.status,
    c.last_verified_at,
    c.updated_at
  from public.pos_provider_credentials c
  where c.location_id = _location_id
    and (
      public.is_tupa_admin()
      or public.user_has_location(_location_id)
    )
$$;

-- 5) Permisos para que los usuarios autenticados puedan llamar la función
do $$
begin
  grant execute on function public.pos_provider_credentials_public(uuid) to authenticated;
end $$;

-- (Opcional) Dejar explícito que anon/authenticated no tienen DML directo sobre la tabla
revoke select, insert, update, delete on public.pos_provider_credentials from anon, authenticated;