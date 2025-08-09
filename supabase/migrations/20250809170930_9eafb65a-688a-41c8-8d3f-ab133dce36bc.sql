
-- 1) Renombrar metadata -> config si existiese
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pos_integrations_tenant' and column_name='metadata'
  ) then
    execute 'alter table public.pos_integrations_tenant rename column metadata to config';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pos_integrations_location' and column_name='metadata'
  ) then
    execute 'alter table public.pos_integrations_location rename column metadata to config';
  end if;
end$$;

-- 2) Triggers updated_at en INSERT/UPDATE (usa función pública set_updated_at ya existente)
do $$
begin
  if to_regclass('public.pos_integrations_tenant') is not null then
    execute 'drop trigger if exists biu_updated_at_pos_tenant on public.pos_integrations_tenant';
    execute 'create trigger biu_updated_at_pos_tenant before insert or update on public.pos_integrations_tenant for each row execute function public.set_updated_at()';
  end if;

  if to_regclass('public.pos_integrations_location') is not null then
    execute 'drop trigger if exists biu_updated_at_pos_location on public.pos_integrations_location';
    execute 'create trigger biu_updated_at_pos_location before insert or update on public.pos_integrations_location for each row execute function public.set_updated_at()';
  end if;
end$$;

-- 3) Realtime: REPLICA IDENTITY FULL + publicación
do $$
begin
  if to_regclass('public.pos_integrations_tenant') is not null then
    execute 'alter table public.pos_integrations_tenant replica identity full';
    begin
      execute 'alter publication supabase_realtime add table public.pos_integrations_tenant';
    exception when duplicate_object then
      null;
    end;
  end if;

  if to_regclass('public.pos_integrations_location') is not null then
    execute 'alter table public.pos_integrations_location replica identity full';
    begin
      execute 'alter publication supabase_realtime add table public.pos_integrations_location';
    exception when duplicate_object then
      null;
    end;
  end if;
end$$;

-- 4) RLS: sólo SELECT; eliminar políticas de INSERT/UPDATE/DELETE
--    (borrado genérico de políticas no-SELECT si existiesen)
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, polname
    from pg_policies
    where schemaname='public'
      and tablename in ('pos_integrations_tenant','pos_integrations_location')
      and cmd in ('INSERT','UPDATE','DELETE')
  loop
    execute format('drop policy %I on public.%I', r.polname, r.tablename);
  end loop;
end$$;

-- Asegurar RLS y políticas SELECT idempotentes
do $$
begin
  if to_regclass('public.pos_integrations_tenant') is not null then
    execute 'alter table public.pos_integrations_tenant enable row level security';

    if not exists (
      select 1 from pg_policies
      where schemaname=''public'' and tablename=''pos_integrations_tenant'' and polname=''pos_tenant_select_by_access''
    ) then
      execute $$create policy "pos_tenant_select_by_access"
      on public.pos_integrations_tenant
      for select
      using (public.user_has_tenant(tenant_id))$$;
    end if;
  end if;

  if to_regclass('public.pos_integrations_location') is not null then
    execute 'alter table public.pos_integrations_location enable row level security';

    if not exists (
      select 1 from pg_policies
      where schemaname=''public'' and tablename=''pos_integrations_location'' and polname=''pos_location_select_by_access''
    ) then
      execute $$create policy "pos_location_select_by_access"
      on public.pos_integrations_location
      for select
      using (public.user_has_location(location_id))$$;
    end if;
  end if;
end$$;

-- 5) Opcional pero recomendado: bloquear privilegios de escrituras directas
do $$
begin
  if to_regclass('public.pos_integrations_tenant') is not null then
    execute 'revoke insert, update, delete on table public.pos_integrations_tenant from authenticated, anon';
  end if;
  if to_regclass('public.pos_integrations_location') is not null then
    execute 'revoke insert, update, delete on table public.pos_integrations_location from authenticated, anon';
  end if;
exception when others then
  -- En entornos donde GRANT/REVOKE no aplique a PostgREST, lo ignoramos
  null;
end$$;

-- 6) RPC effective_pos (guards + chequeo pertenencia location→tenant)
create or replace function public.effective_pos(_tenant_id uuid, _location_id uuid default null)
returns table(provider app_pos_provider, source text, connected boolean)
language plpgsql
stable
security definer
set search_path = 'public, extensions'
as $$
begin
  if not public.user_has_tenant(_tenant_id) then
    raise exception 'forbidden';
  end if;

  if _location_id is not null then
    if not public.user_has_location(_location_id) then
      raise exception 'forbidden';
    end if;
    if not exists (
      select 1 from public.locations l
      where l.id = _location_id and l.tenant_id = _tenant_id
    ) then
      raise exception 'location does not belong to tenant';
    end if;
  end if;

  return query
  with loc as (
    select pil.provider, 'location'::text as source, true as connected
    from public.pos_integrations_location pil
    where pil.location_id is not distinct from _location_id
      and pil.connected is true
    limit 1
  ), ten as (
    select pit.provider, 'tenant'::text as source, true as connected
    from public.pos_integrations_tenant pit
    where pit.tenant_id = _tenant_id
      and pit.connected is true
    limit 1
  )
  select * from loc
  union all
  select * from ten
  limit 1;
end;
$$;

-- 7) RPC set_pos_tenant (locks 2x int4, idempotente)
create or replace function public.set_pos_tenant(_tenant_id uuid, _provider app_pos_provider, _connected boolean, _config jsonb default '{}'::jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = 'public, extensions'
as $$
declare
  k1 int4;
  k2 int4;
begin
  -- permisos: admin o owner del tenant
  if not (public.is_tupa_admin() or (public.user_has_tenant(_tenant_id) and public.has_role(auth.uid(), 'owner'))) then
    raise exception 'only tupa_admin or tenant owner';
  end if;

  -- lock por UUID (dos claves int4)
  k1 := ('x'||substr(replace(_tenant_id::text,'-',''),1,8))::bit(32)::int;
  k2 := ('x'||substr(replace(_tenant_id::text,'-',''),9,8))::bit(32)::int;
  perform pg_advisory_xact_lock(k1, k2);

  if _connected then
    update public.pos_integrations_tenant
    set connected = false, updated_at = now()
    where tenant_id = _tenant_id and connected = true;
  end if;

  -- upsert idempotente
  loop
    begin
      insert into public.pos_integrations_tenant as t (tenant_id, provider, connected, config)
      values (_tenant_id, _provider, _connected, coalesce(_config, '{}'::jsonb))
      on conflict (tenant_id, provider)
      do update set connected = excluded.connected,
                   config = excluded.config,
                   updated_at = now();
      exit;
    exception when unique_violation then
      -- choque por índice parcial de connected=true: retry cortito; UX mostrará mensaje si corresponde
      perform pg_sleep(0.02);
    end;
  end loop;
end;
$$;

-- 8) RPC set_pos_location (locks 2x int4, idempotente y validación pertenencia)
create or replace function public.set_pos_location(_location_id uuid, _provider app_pos_provider, _connected boolean, _config jsonb default '{}'::jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = 'public, extensions'
as $$
declare
  k1 int4;
  k2 int4;
  v_tenant uuid;
begin
  select l.tenant_id into v_tenant from public.locations l where l.id = _location_id;
  if v_tenant is null then
    raise exception 'invalid location';
  end if;

  -- permisos: admin o owner del tenant / location
  if not (public.is_tupa_admin() or (public.user_has_location(_location_id) and public.has_role(auth.uid(), 'owner'))) then
    raise exception 'only tupa_admin or tenant owner';
  end if;

  -- lock por UUID (dos claves int4)
  k1 := ('x'||substr(replace(_location_id::text,'-',''),1,8))::bit(32)::int;
  k2 := ('x'||substr(replace(_location_id::text,'-',''),9,8))::bit(32)::int;
  perform pg_advisory_xact_lock(k1, k2);

  if _connected then
    update public.pos_integrations_location
    set connected = false, updated_at = now()
    where location_id = _location_id and connected = true;
  end if;

  -- upsert idempotente
  loop
    begin
      insert into public.pos_integrations_location as t (location_id, provider, connected, config)
      values (_location_id, _provider, _connected, coalesce(_config, '{}'::jsonb))
      on conflict (location_id, provider)
      do update set connected = excluded.connected,
                   config = excluded.config,
                   updated_at = now();
      exit;
    exception when unique_violation then
      perform pg_sleep(0.02);
    end;
  end loop;
end;
$$;

-- 9) Grants mínimos
do $$
begin
  execute 'grant execute on function public.effective_pos(uuid, uuid) to authenticated';
  execute 'grant execute on function public.set_pos_tenant(uuid, app_pos_provider, boolean, jsonb) to authenticated';
  execute 'grant execute on function public.set_pos_location(uuid, app_pos_provider, boolean, jsonb) to authenticated';
exception when undefined_function then
  null;
end$$;

-- 10) Comentarios (observabilidad)
comment on table public.pos_integrations_tenant is 'POS integrations scoped to tenant. Only SELECT via RLS; writes through RPC set_pos_tenant()';
comment on table public.pos_integrations_location is 'POS integrations scoped to location. Only SELECT via RLS; writes through RPC set_pos_location()';
comment on function public.effective_pos(uuid, uuid) is 'Returns the effective POS (provider/source/connected) for a tenant/location with full guards';
comment on function public.set_pos_tenant(uuid, app_pos_provider, boolean, jsonb) is 'Transactional connect/disconnect of POS at tenant scope with advisory locks';
comment on function public.set_pos_location(uuid, app_pos_provider, boolean, jsonb) is 'Transactional connect/disconnect of POS at location scope with advisory locks';
