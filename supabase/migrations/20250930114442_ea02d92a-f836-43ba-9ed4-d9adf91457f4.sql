-- Fix critical security vulnerability: Remove public access to locations table
-- This prevents competitors from stealing business location data

-- Drop the vulnerable policy that allows public read access
DROP POLICY IF EXISTS "locations_basic_read" ON public.locations;

-- Create secure policy for authenticated users with proper tenant access
CREATE POLICY "locations_secure_read" 
ON public.locations 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND (
    -- Platform admins can see all locations
    public.is_tupa_admin() 
    OR 
    -- Users can see locations they have direct access to
    public.user_has_location(id)
    OR
    -- Users can see locations in tenants they have access to
    public.user_has_tenant(tenant_id)
  )
);

-- Log the security fix
INSERT INTO public.pos_logs (level, scope, message, meta)
VALUES (
  'info',
  'security_fix',
  'Fixed critical security vulnerability - removed public access to locations table',
  jsonb_build_object(
    'vulnerability', 'PUBLIC_BUSINESS_DATA',
    'table', 'locations',
    'fix_date', now(),
    'description', 'Replaced public read policy with authenticated tenant-based access control'
  )
);