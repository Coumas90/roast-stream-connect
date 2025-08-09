
-- 1) Enum app_pos_provider (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_pos_provider') THEN
    CREATE TYPE public.app_pos_provider AS ENUM ('odoo','fudo','maxirest','bistrosoft','other');
    COMMENT ON TYPE public.app_pos_provider IS 'POS providers supported at tenant/location scope';
  END IF;
END
$$;

-- 2) Tablas
DO $$
BEGIN
  IF to_regclass('public.pos_integrations_tenant') IS NULL THEN
    CREATE TABLE public.pos_integrations_tenant (
      tenant_id uuid NOT NULL,
      provider public.app_pos_provider NOT NULL,
      connected boolean NOT NULL DEFAULT false,
      config jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.pos_integrations_tenant
      ADD CONSTRAINT pos_it_unique UNIQUE (tenant_id, provider);
    COMMENT ON TABLE public.pos_integrations_tenant IS 'Tenant-scoped POS connections';
    COMMENT ON COLUMN public.pos_integrations_tenant.config IS 'Provider-specific config';
  END IF;

  IF to_regclass('public.pos_integrations_location') IS NULL THEN
    CREATE TABLE public.pos_integrations_location (
      tenant_id uuid NOT NULL,
      location_id uuid NOT NULL,
      provider public.app_pos_provider NOT NULL,
      connected boolean NOT NULL DEFAULT false,
      config jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.pos_integrations_location
      ADD CONSTRAINT pos_il_unique UNIQUE (location_id, provider);
    COMMENT ON TABLE public.pos_integrations_location IS 'Location-scoped POS overrides';
    COMMENT ON COLUMN public.pos_integrations_location.config IS 'Provider-specific config';
  END IF;
END
$$;

-- Asegurar constraints si la tabla existía sin ellas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='pos_integrations_tenant' AND constraint_name='pos_it_unique'
  ) THEN
    ALTER TABLE public.pos_integrations_tenant
      ADD CONSTRAINT pos_it_unique UNIQUE (tenant_id, provider);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='pos_integrations_location' AND constraint_name='pos_il_unique'
  ) THEN
    ALTER TABLE public.pos_integrations_location
      ADD CONSTRAINT pos_il_unique UNIQUE (location_id, provider);
  END IF;
END
$$;

-- 3) RLS y políticas
ALTER TABLE public.pos_integrations_tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_integrations_location ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='pos_integrations_tenant' AND polname='pos_it_select_by_tenant'
  ) THEN
    CREATE POLICY pos_it_select_by_tenant
      ON public.pos_integrations_tenant
      FOR SELECT
      USING (public.user_has_tenant(tenant_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='pos_integrations_tenant' AND polname='pos_it_write_admin_only'
  ) THEN
    CREATE POLICY pos_it_write_admin_only
      ON public.pos_integrations_tenant
      FOR ALL
      USING (public.is_tupa_admin())
      WITH CHECK (public.is_tupa_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='pos_integrations_location' AND polname='pos_il_select_by_location'
  ) THEN
    CREATE POLICY pos_il_select_by_location
      ON public.pos_integrations_location
      FOR SELECT
      USING (public.user_has_location(location_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='pos_integrations_location' AND polname='pos_il_write_admin_only'
  ) THEN
    CREATE POLICY pos_il_write_admin_only
      ON public.pos_integrations_location
      FOR ALL
      USING (public.is_tupa_admin())
      WITH CHECK (public.is_tupa_admin());
  END IF;
END
$$;

-- 4) Índices
-- Únicos parciales: máximo 1 provider conectado por tenant/location
CREATE UNIQUE INDEX IF NOT EXISTS pos_it_one_connected
  ON public.pos_integrations_tenant(tenant_id)
  WHERE connected IS TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS pos_il_one_connected
  ON public.pos_integrations_location(location_id)
  WHERE connected IS TRUE;

-- Índices de soporte por acceso típico (evitamos duplicar los del UNIQUE)
CREATE INDEX IF NOT EXISTS idx_pos_it_tenant_provider
  ON public.pos_integrations_tenant(tenant_id, provider);

CREATE INDEX IF NOT EXISTS idx_pos_il_loc_provider
  ON public.pos_integrations_location(location_id, provider);

CREATE INDEX IF NOT EXISTS idx_pos_il_tenant_location
  ON public.pos_integrations_location(tenant_id, location_id);

-- 5) Triggers updated_at (INSERT y UPDATE)
DROP TRIGGER IF EXISTS set_pos_it_updated ON public.pos_integrations_tenant;
CREATE TRIGGER set_pos_it_updated
  BEFORE INSERT OR UPDATE ON public.pos_integrations_tenant
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_pos_il_updated ON public.pos_integrations_location;
CREATE TRIGGER set_pos_il_updated
  BEFORE INSERT OR UPDATE ON public.pos_integrations_location
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) Realtime
ALTER TABLE public.pos_integrations_tenant REPLICA IDENTITY FULL;
ALTER TABLE public.pos_integrations_location REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='pos_integrations_tenant'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_integrations_tenant';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='pos_integrations_location'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_integrations_location';
  END IF;
END
$$;

-- 7) Función effective_pos con guards y check de pertenencia
CREATE OR REPLACE FUNCTION public.effective_pos(_tenant_id uuid, _location_id uuid)
RETURNS TABLE(provider public.app_pos_provider, connected boolean, source text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = 'public, extensions'
AS $$
BEGIN
  -- Guard: acceso por tenant
  IF NOT public.user_has_tenant(_tenant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Si viene location, validar acceso y pertenencia al tenant
  IF _location_id IS NOT NULL THEN
    IF NOT public.user_has_location(_location_id) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;

    PERFORM 1
    FROM public.locations l
    WHERE l.id = _location_id AND l.tenant_id = _tenant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'location does not belong to tenant';
    END IF;

    -- Prioridad: override por sucursal
    RETURN QUERY
    SELECT pil.provider, TRUE, 'location'
    FROM public.pos_integrations_location pil
    WHERE pil.tenant_id = _tenant_id
      AND pil.location_id = _location_id
      AND pil.connected IS TRUE
    LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- Tenant scope
  RETURN QUERY
  SELECT pit.provider, TRUE, 'tenant'
  FROM public.pos_integrations_tenant pit
  WHERE pit.tenant_id = _tenant_id
    AND pit.connected IS TRUE
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  -- Nada conectado
  provider := NULL;
  connected := FALSE;
  source := 'none';
  RETURN NEXT;
  RETURN;
END
$$;

COMMENT ON FUNCTION public.effective_pos(uuid, uuid) IS 'Resolves effective POS (provider, connected, source) prioritizing location over tenant';

-- 8) RPCs transaccionales con advisory locks 2×int4
CREATE OR REPLACE FUNCTION public.set_pos_tenant(
  _tenant_id uuid,
  _provider public.app_pos_provider,
  _connected boolean,
  _config jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = 'public, extensions'
AS $$
DECLARE
  k1 int;
  k2 int;
BEGIN
  IF NOT public.is_tupa_admin() THEN
    RAISE EXCEPTION 'only tupa_admin';
  END IF;

  -- Validar existencia de tenant
  PERFORM 1 FROM public.tenants t WHERE t.id = _tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tenant not found';
  END IF;

  -- Advisory lock 2×int4 derivado del UUID
  k1 := ('x'||substr(replace(_tenant_id::text,'-',''),1,8))::bit(32)::int;
  k2 := ('x'||substr(replace(_tenant_id::text,'-',''),9,8))::bit(32)::int;
  PERFORM pg_advisory_xact_lock(k1, k2);

  IF _connected IS TRUE THEN
    -- Apagar cualquiera conectado
    UPDATE public.pos_integrations_tenant
      SET connected = FALSE
    WHERE tenant_id = _tenant_id AND connected IS TRUE;

    -- Upsert proveedor objetivo conectado
    INSERT INTO public.pos_integrations_tenant(tenant_id, provider, connected, config)
    VALUES (_tenant_id, _provider, TRUE, COALESCE(_config, '{}'::jsonb))
    ON CONFLICT (tenant_id, provider) DO UPDATE
      SET connected = EXCLUDED.connected,
          config = EXCLUDED.config,
          updated_at = now();
  ELSE
    -- Apagar solo el proveedor objetivo (si existe); si no existe, lo creamos apagado con config si vino
    INSERT INTO public.pos_integrations_tenant(tenant_id, provider, connected, config)
    VALUES (_tenant_id, _provider, FALSE, COALESCE(_config, '{}'::jsonb))
    ON CONFLICT (tenant_id, provider) DO UPDATE
      SET connected = FALSE,
          config = COALESCE(EXCLUDED.config, public.pos_integrations_tenant.config),
          updated_at = now();
  END IF;
END
$$;

COMMENT ON FUNCTION public.set_pos_tenant(uuid, public.app_pos_provider, boolean, jsonb) IS 'Transactional setter for tenant POS; ensures single connected provider per tenant';

CREATE OR REPLACE FUNCTION public.set_pos_location(
  _tenant_id uuid,
  _location_id uuid,
  _provider public.app_pos_provider,
  _connected boolean,
  _config jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = 'public, extensions'
AS $$
DECLARE
  k1 int;
  k2 int;
BEGIN
  IF NOT public.is_tupa_admin() THEN
    RAISE EXCEPTION 'only tupa_admin';
  END IF;

  -- Validar pertenencia location↔tenant y acceso
  PERFORM 1 FROM public.locations l WHERE l.id = _location_id AND l.tenant_id = _tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'location does not belong to tenant';
  END IF;

  -- Advisory lock 2×int4 derivado del UUID de location
  k1 := ('x'||substr(replace(_location_id::text,'-',''),1,8))::bit(32)::int;
  k2 := ('x'||substr(replace(_location_id::text,'-',''),9,8))::bit(32)::int;
  PERFORM pg_advisory_xact_lock(k1, k2);

  IF _connected IS TRUE THEN
    -- Apagar cualquiera conectado en la sucursal
    UPDATE public.pos_integrations_location
      SET connected = FALSE
    WHERE location_id = _location_id AND connected IS TRUE;

    -- Upsert proveedor objetivo conectado
    INSERT INTO public.pos_integrations_location(tenant_id, location_id, provider, connected, config)
    VALUES (_tenant_id, _location_id, _provider, TRUE, COALESCE(_config, '{}'::jsonb))
    ON CONFLICT (location_id, provider) DO UPDATE
      SET connected = EXCLUDED.connected,
          config = EXCLUDED.config,
          updated_at = now();
  ELSE
    -- Apagar solo el proveedor objetivo (si existe); si no existe, lo creamos apagado con config si vino
    INSERT INTO public.pos_integrations_location(tenant_id, location_id, provider, connected, config)
    VALUES (_tenant_id, _location_id, _provider, FALSE, COALESCE(_config, '{}'::jsonb))
    ON CONFLICT (location_id, provider) DO UPDATE
      SET connected = FALSE,
          config = COALESCE(EXCLUDED.config, public.pos_integrations_location.config),
          updated_at = now();
  END IF;
END
$$;

COMMENT ON FUNCTION public.set_pos_location(uuid, uuid, public.app_pos_provider, boolean, jsonb) IS 'Transactional setter for location POS; ensures single connected provider per location';

-- 9) Grants mínimos
GRANT EXECUTE ON FUNCTION public.effective_pos(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_pos_tenant(uuid, public.app_pos_provider, boolean, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_pos_location(uuid, uuid, public.app_pos_provider, boolean, jsonb) TO authenticated;

-- 10) Migración de compatibilidad desde public.pos_integrations (Odoo→tenant)
DO $$
BEGIN
  IF to_regclass('public.pos_integrations') IS NOT NULL THEN
    INSERT INTO public.pos_integrations_tenant(tenant_id, provider, connected, config)
    SELECT p.tenant_id,
           'odoo'::public.app_pos_provider,
           p.connected,
           COALESCE(p.metadata, '{}'::jsonb)
    FROM public.pos_integrations p
    WHERE p.provider = 'odoo' AND p.connected IS TRUE
    ON CONFLICT (tenant_id, provider) DO UPDATE
      SET connected = EXCLUDED.connected,
          config = public.pos_integrations_tenant.config || EXCLUDED.config,
          updated_at = now();
    -- Kill switch opcional (pospuesto hasta migrar el front):
    -- UPDATE public.pos_integrations SET connected = FALSE, updated_at = now()
    -- WHERE provider = 'odoo' AND connected IS TRUE;
  END IF;
END
$$;

-- 11) Vista de diagnóstico
CREATE OR REPLACE VIEW public.v_pos_effective_locations AS
SELECT
  l.tenant_id,
  l.id AS location_id,
  ep.provider,
  ep.connected,
  ep.source
FROM public.locations l
CROSS JOIN LATERAL public.effective_pos(l.tenant_id, l.id) ep;

COMMENT ON VIEW public.v_pos_effective_locations IS 'Diagnostic view listing effective POS by location, guarded by RLS and function checks';
