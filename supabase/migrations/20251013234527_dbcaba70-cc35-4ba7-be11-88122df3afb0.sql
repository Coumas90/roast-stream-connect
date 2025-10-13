-- Fix RLS policies for my-team page

-- 1. Update invitations RLS policy to allow location-based access
DROP POLICY IF EXISTS "invitations_select_admin_only" ON public.invitations;

CREATE POLICY "invitations_select_by_location_access" 
ON public.invitations
FOR SELECT
USING (
  is_tupa_admin() 
  OR user_has_location(location_id)
);

-- 2. Add RLS policy for user_roles to allow users to read their own roles
CREATE POLICY "user_roles_select_own_roles" 
ON public.user_roles
FOR SELECT
USING (
  auth.uid() = user_id 
  OR is_tupa_admin()
);

-- 3. Verify user_has_location() function exists and is correct
CREATE OR REPLACE FUNCTION public.user_has_location(_location_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        ur.location_id = _location_id 
        OR (ur.location_id IS NULL AND ur.tenant_id = (
          SELECT tenant_id FROM public.locations WHERE id = _location_id
        ))
      )
  );
END;
$$;