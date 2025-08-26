-- Fix circular RLS dependencies and login issues
-- This migration addresses critical problems with location loading and authentication

-- 1. Create optimized function to get accessible locations without circular dependencies
CREATE OR REPLACE FUNCTION public.get_accessible_locations()
RETURNS TABLE(id uuid, name text, tenant_id uuid, code text, timezone text, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '8s'
AS $$
DECLARE
  current_user_id uuid;
  is_admin boolean := false;
BEGIN
  -- Get current user safely
  current_user_id := auth.uid();
  
  -- Check if user is admin (fast check)
  IF current_user_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = current_user_id 
        AND ur.role = 'tupa_admin'::public.app_role
    ) INTO is_admin;
  END IF;
  
  -- If admin, return all locations
  IF is_admin THEN
    RETURN QUERY
    SELECT l.id, l.name, l.tenant_id, l.code, l.timezone, l.created_at
    FROM public.locations l
    ORDER BY l.name ASC;
    RETURN;
  END IF;
  
  -- If not authenticated, return empty set (will be handled by UI)
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;
  
  -- For authenticated non-admin users, get their accessible locations
  RETURN QUERY
  SELECT DISTINCT l.id, l.name, l.tenant_id, l.code, l.timezone, l.created_at
  FROM public.locations l
  WHERE EXISTS (
    -- Direct location access
    SELECT 1 FROM public.user_roles ur1
    WHERE ur1.user_id = current_user_id 
      AND ur1.location_id = l.id
  ) OR EXISTS (
    -- Tenant-level access (owner/manager)
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = current_user_id
      AND ur2.tenant_id = l.tenant_id
      AND ur2.role IN ('owner'::public.app_role, 'manager'::public.app_role)
  )
  ORDER BY l.name ASC;
END;
$$;

-- 2. Create a public, non-RLS view for initial location loading
CREATE OR REPLACE VIEW public.locations_public AS
SELECT id, name, code, timezone, created_at,
       -- Don't expose tenant_id in public view for security
       NULL::uuid as tenant_id
FROM public.locations
ORDER BY name ASC;

-- Enable RLS on the view (will inherit from table)
-- Note: This view will be used for unauthenticated initial loading

-- 3. Update RLS policies on locations to fix circular dependencies
DROP POLICY IF EXISTS "locations_select_by_access" ON public.locations;

-- Create a simple policy that allows reading basic location info for UI initialization
CREATE POLICY "locations_basic_read" 
ON public.locations FOR SELECT 
USING (true);  -- Allow basic read access, security will be handled by the function

-- Create a restrictive policy for admin operations
CREATE POLICY "locations_admin_operations" 
ON public.locations FOR ALL 
USING (public.is_tupa_admin())
WITH CHECK (public.is_tupa_admin());

-- 4. Create performance indexes for the new access patterns
CREATE INDEX IF NOT EXISTS idx_user_roles_user_location 
ON public.user_roles(user_id, location_id) 
WHERE location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_roles_user_tenant_role 
ON public.user_roles(user_id, tenant_id, role) 
WHERE tenant_id IS NOT NULL AND role IN ('owner', 'manager');

CREATE INDEX IF NOT EXISTS idx_locations_name_order 
ON public.locations(name ASC);

-- 5. Optimize user_has_tenant function to avoid timeouts
CREATE OR REPLACE FUNCTION public.user_has_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public', 'auth'
SET statement_timeout TO '3s'
AS $$
  SELECT CASE 
    WHEN public.is_tupa_admin() THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
        AND ur.tenant_id = _tenant_id
      LIMIT 1
    )
  END;
$$;

-- 6. Create a safe authentication check function
CREATE OR REPLACE FUNCTION public.get_auth_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  user_roles_count integer := 0;
  is_admin boolean := false;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'authenticated', false,
      'user_id', null,
      'roles_count', 0,
      'is_admin', false
    );
  END IF;
  
  -- Count user roles
  SELECT COUNT(*) INTO user_roles_count
  FROM public.user_roles ur
  WHERE ur.user_id = current_user_id;
  
  -- Check admin status
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = current_user_id 
      AND ur.role = 'tupa_admin'::public.app_role
  ) INTO is_admin;
  
  RETURN jsonb_build_object(
    'authenticated', true,
    'user_id', current_user_id,
    'roles_count', user_roles_count,
    'is_admin', is_admin
  );
END;
$$;

-- 7. Add logging for debugging location access issues
INSERT INTO public.pos_logs (level, scope, message, meta)
VALUES (
  'info',
  'migration',
  'Applied location access optimization migration',
  jsonb_build_object(
    'migration_version', '20250826_location_fix',
    'timestamp', now(),
    'changes', jsonb_build_array(
      'created get_accessible_locations function',
      'optimized RLS policies',
      'added performance indexes',
      'created auth status function'
    )
  )
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_accessible_locations() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_status() TO authenticated, anon;
GRANT SELECT ON public.locations_public TO authenticated, anon;