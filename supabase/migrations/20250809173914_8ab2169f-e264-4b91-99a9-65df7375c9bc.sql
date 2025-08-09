-- POS multi-provider hardening: enum, tables, RLS, triggers, realtime, RPCs, grants
-- 1) Enum app_pos_provider (sin 'odoo'; Odoo se mapea como 'other')
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'app_pos_provider') THEN
    CREATE TYPE public.app_pos_provider AS ENUM ('fudo','maxirest','bistrosoft','other');
  END IF;
END
$$;

-- 2) Tablas POS a nivel tenant y location
CREATE TABLE IF NOT EXISTS public.pos_integrations_tenant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider public.app_pos_provider NOT NULL,
  connected boolean NOT NULL DEFAULT false,
  config jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pos_integrations_location (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  provider public.app_pos_provider NOT NULL,
  connected boolean NOT NULL DEFAULT false,
  config jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices y unicidad (una conexión efectiva por ámbito)
DO $$
BEGIN
  -- Un único registro conectado por tenant
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'uq_pos_tenant_connected_one' AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX uq_pos_tenant_connected_one
      ON public.pos_integrations_tenant (tenant_id)
      WHERE connected = true;
  END IF;

  -- Un único registro conectado por location
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'uq_pos_location_connected_one' AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX uq_pos_location_connected_one
      ON public.pos_integrations_location (location_id)
      WHERE connected = true;
  END IF;

  -- Soporte para upsert específico por proveedor
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_pos_tenant_provider'
  ) THEN
    ALTER TABLE public.pos_integrations_tenant
      ADD CONSTRAINT uq_pos_tenant_provider UNIQUE (tenant_id, provider);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_pos_location_provider'
  ) THEN
    ALTER TABLE public.pos_integrations_location
      ADD CONSTRAINT uq_pos_location_provider UNIQUE (location_id, provider);
  END IF;
END
$$;

-- Índices de acceso
CREATE INDEX IF NOT EXISTS idx_pos_tenant_tenant_id ON public.pos_integrations_tenant(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_location_location_id ON public.pos_integrations_location(location_id);

-- 3) RLS: solo SELECT; escrituras vía RPC
ALTER TABLE public.pos_integrations_tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_integrations_location ENABLE ROW LEVEL SECURITY;

-- Policies idempotentes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pos_integrations_tenant' AND policyname = 'pos_tenant_select_by_access'
  ) THEN
    CREATE POLICY "pos_tenant_select_by_access"
    ON public.pos_integrations_tenant
    FOR SELECT
    USING (public.user_has_tenant(tenant_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pos_integrations_location' AND policyname = 'pos_location_select_by_access'
  ) THEN
    CREATE POLICY "pos_location_select_by_access"
    ON public.pos_integrations_location
    FOR SELECT
    USING (public.user_has_location(location_id));
  END IF;
END$$;

-- 4) Triggers updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pos_tenant_set_updated_at') THEN
    CREATE TRIGGER trg_pos_tenant_set_updated_at
    BEFORE UPDATE ON public.pos_integrations_tenant
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pos_location_set_updated_at') THEN
    CREATE TRIGGER trg_pos_location_set_updated_at
    BEFORE UPDATE ON public.pos_integrations_location
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- 5) Realtime
ALTER TABLE public.pos_integrations_tenant REPLICA IDENTITY FULL;
ALTER TABLE public.pos_integrations_location REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_integrations_tenant;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_integrations_location;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END$$;

-- 6) RPCs
-- a) effective_pos
CREATE OR REPLACE FUNCTION public.effective_pos(
  _tenant_id uuid,
  _location_id uuid DEFAULT NULL
)
RETURNS TABLE(provider public.app_pos_provider, source text, connected boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
BEGIN
  -- Autorización a nivel tenant (admin platform también permitido dentro de user_has_tenant)
  IF NOT public.user_has_tenant(_tenant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Prioridad: location conectado > tenant conectado
  IF _location_id IS NOT NULL THEN
    RETURN QUERY
    SELECT pil.provider, 'location'::text AS source, pil.connected
    FROM public.pos_integrations_location pil
    WHERE pil.location_id = _location_id AND pil.connected = true
    LIMIT 1;
  END IF;

  -- Si no hay override o no hay location
  RETURN QUERY
  SELECT pit.provider, 'tenant'::text AS source, pit.connected
  FROM public.pos_integrations_tenant pit
  WHERE pit.tenant_id = _tenant_id AND pit.connected = true
  LIMIT 1;
END;
$$;

-- b) set_pos_tenant
CREATE OR REPLACE FUNCTION public.set_pos_tenant(
  _tenant_id uuid,
  _provider public.app_pos_provider,
  _connected boolean,
  _config jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  -- Permisos: admin plataforma o owner del tenant
  IF NOT (public.is_tupa_admin() OR (public.user_has_tenant(_tenant_id) AND public.has_role(auth.uid(), 'owner'))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Lock por tenant para evitar carreras
  PERFORM pg_advisory_xact_lock(hashtextextended(_tenant_id::text, 0));

  IF _connected THEN
    -- Apagar otros proveedores conectados
    UPDATE public.pos_integrations_tenant
    SET connected = false, updated_at = v_now
    WHERE tenant_id = _tenant_id AND connected = true AND provider IS DISTINCT FROM _provider;

    -- Upsert proveedor objetivo
    INSERT INTO public.pos_integrations_tenant(tenant_id, provider, connected, config, created_at, updated_at)
    VALUES (_tenant_id, _provider, true, COALESCE(_config, '{}'::jsonb), v_now, v_now)
    ON CONFLICT (tenant_id, provider)
    DO UPDATE SET connected = EXCLUDED.connected, config = EXCLUDED.config, updated_at = v_now;
  ELSE
    -- Desconectar proveedor objetivo
    INSERT INTO public.pos_integrations_tenant(tenant_id, provider, connected, config, created_at, updated_at)
    VALUES (_tenant_id, _provider, false, COALESCE(_config, '{}'::jsonb), v_now, v_now)
    ON CONFLICT (tenant_id, provider)
    DO UPDATE SET connected = false, config = COALESCE(_config, public.pos_integrations_tenant.config), updated_at = v_now;
  END IF;
END;
$$;

-- c) set_pos_location
CREATE OR REPLACE FUNCTION public.set_pos_location(
  _location_id uuid,
  _provider public.app_pos_provider,
  _connected boolean,
  _config jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  -- Permisos: admin o (owner/manager) con acceso a la sucursal
  IF NOT (
    public.is_tupa_admin()
    OR (public.user_has_location(_location_id) AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager')))
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Lock por location
  PERFORM pg_advisory_xact_lock(hashtextextended(_location_id::text, 0));

  IF _connected THEN
    UPDATE public.pos_integrations_location
    SET connected = false, updated_at = v_now
    WHERE location_id = _location_id AND connected = true AND provider IS DISTINCT FROM _provider;

    INSERT INTO public.pos_integrations_location(location_id, provider, connected, config, created_at, updated_at)
    VALUES (_location_id, _provider, true, COALESCE(_config, '{}'::jsonb), v_now, v_now)
    ON CONFLICT (location_id, provider)
    DO UPDATE SET connected = EXCLUDED.connected, config = EXCLUDED.config, updated_at = v_now;
  ELSE
    INSERT INTO public.pos_integrations_location(location_id, provider, connected, config, created_at, updated_at)
    VALUES (_location_id, _provider, false, COALESCE(_config, '{}'::jsonb), v_now, v_now)
    ON CONFLICT (location_id, provider)
    DO UPDATE SET connected = false, config = COALESCE(_config, public.pos_integrations_location.config), updated_at = v_now;
  END IF;
END;
$$;

-- 7) Privilegios mínimos
-- Bloquear escrituras directas para roles de API
REVOKE INSERT, UPDATE, DELETE ON public.pos_integrations_tenant FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.pos_integrations_location FROM anon, authenticated;
-- Permitir lectura (AÚN pasa por RLS)
GRANT SELECT ON public.pos_integrations_tenant TO authenticated;
GRANT SELECT ON public.pos_integrations_location TO authenticated;

-- Ejecutar RPCs desde clientes autenticados
GRANT EXECUTE ON FUNCTION public.effective_pos(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_pos_tenant(uuid, public.app_pos_provider, boolean, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_pos_location(uuid, public.app_pos_provider, boolean, jsonb) TO authenticated;