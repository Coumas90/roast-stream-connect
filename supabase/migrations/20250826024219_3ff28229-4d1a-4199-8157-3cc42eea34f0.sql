-- A. Actualizar vistas existentes con security_invoker = on
ALTER VIEW public.pos_dashboard_expirations SET (security_invoker = on);
ALTER VIEW public.pos_dashboard_breakers SET (security_invoker = on);

-- Forzar invoker en todas las vistas públicas existentes
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, viewname FROM pg_views WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER VIEW %I.%I SET (security_invoker = on);', r.schemaname, r.viewname);
  END LOOP;
END$$;

-- B. Corregir grants y exposición
-- Revocar permisos de funciones SECURITY DEFINER problemáticas
REVOKE ALL ON FUNCTION public.get_dashboard_expirations() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_dashboard_breakers() FROM PUBLIC, anon, authenticated;

-- Convertir funciones dashboard a SECURITY INVOKER (mejor práctica)
ALTER FUNCTION public.get_dashboard_expirations() SECURITY INVOKER;
ALTER FUNCTION public.get_dashboard_breakers() SECURITY INVOKER;

-- Grants restrictivos en vistas
REVOKE ALL ON public.pos_credentials_public FROM PUBLIC, anon;
REVOKE ALL ON public.pos_dashboard_expirations FROM PUBLIC, anon;
REVOKE ALL ON public.pos_dashboard_breakers FROM PUBLIC, anon;

GRANT SELECT ON public.pos_credentials_public TO authenticated;
GRANT SELECT ON public.pos_dashboard_expirations TO authenticated;
GRANT SELECT ON public.pos_dashboard_breakers TO authenticated;

-- C. Corregir helper functions a SECURITY INVOKER con search_path explícito
CREATE OR REPLACE FUNCTION public.is_tupa_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth
AS $$
  SELECT public.has_role(auth.uid(), 'tupa_admin'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.user_has_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = _tenant_id
  ) OR public.is_tupa_admin();
$$;

CREATE OR REPLACE FUNCTION public.user_has_location(_location_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth
AS $$
  SELECT
    public.is_tupa_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.location_id = _location_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.locations l ON l.id = _location_id
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = l.tenant_id
        AND ur.role IN ('owner'::public.app_role, 'manager'::public.app_role)
    );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_pos(_location_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, auth
AS $$
  SELECT
    public.is_tupa_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.location_id = _location_id
        AND ur.role IN ('manager'::public.app_role)
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.locations l ON l.tenant_id = ur.tenant_id
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'owner'::public.app_role
        AND l.id = _location_id
    );
$$;

-- D. Asegurar RLS en tablas críticas
ALTER TABLE public.pos_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_provider_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotation_cb ENABLE ROW LEVEL SECURITY;

-- E. Eliminar funciones dashboard SECURITY DEFINER innecesarias
-- Ya que ahora usamos vistas invoker que heredan RLS automáticamente
DROP FUNCTION IF EXISTS public.get_dashboard_expirations();
DROP FUNCTION IF EXISTS public.get_dashboard_breakers();