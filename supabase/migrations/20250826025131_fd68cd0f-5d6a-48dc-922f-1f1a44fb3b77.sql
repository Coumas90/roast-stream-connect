-- Performance optimizations to fix timeout issues (fixed version without CONCURRENTLY)

-- 1. Add critical indexes for authorization functions
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_tenant ON public.user_roles(user_id, tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_user_location ON public.user_roles(user_id, location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_locations_tenant_id ON public.locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_locations_name_tenant ON public.locations(name, tenant_id);

-- 2. Optimize the most critical authorization functions
CREATE OR REPLACE FUNCTION public.user_has_location(_location_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth
AS $$
  -- Fast path for admin users
  SELECT CASE 
    WHEN public.has_role(auth.uid(), 'tupa_admin'::public.app_role) THEN true
    ELSE (
      -- Direct location access
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() 
          AND ur.location_id = _location_id
      )
      OR 
      -- Tenant-level access with owner/manager role
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        INNER JOIN public.locations l ON l.tenant_id = ur.tenant_id
        WHERE ur.user_id = auth.uid()
          AND l.id = _location_id
          AND ur.role IN ('owner'::public.app_role, 'manager'::public.app_role)
      )
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth
AS $$
  -- Fast path for admin users
  SELECT CASE 
    WHEN public.has_role(auth.uid(), 'tupa_admin'::public.app_role) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
        AND ur.tenant_id = _tenant_id
    )
  END;
$$;

-- 3. Add query timeout settings for problematic functions
ALTER FUNCTION public.user_has_location SET statement_timeout = '5s';
ALTER FUNCTION public.user_has_tenant SET statement_timeout = '5s';
ALTER FUNCTION public.is_tupa_admin SET statement_timeout = '3s';
ALTER FUNCTION public.has_role SET statement_timeout = '3s';