-- Update the RLS policy for training_requests to allow admin context updates
DROP POLICY IF EXISTS "training_requests_update_admin_or_owner" ON public.training_requests;

-- Create a more permissive policy for admin users
CREATE POLICY "training_requests_update_admin_access" 
ON public.training_requests 
FOR UPDATE 
USING (
  -- Allow tupa_admin (platform administrators)
  public.is_tupa_admin() 
  OR 
  -- Allow authenticated users who have owner/manager roles for the tenant/location
  (
    auth.uid() IS NOT NULL 
    AND (
      -- User has owner role for the tenant
      EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
          AND ur.tenant_id = training_requests.tenant_id 
          AND ur.role = 'owner'::public.app_role
      )
      OR
      -- User has manager role for the tenant  
      EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
          AND ur.tenant_id = training_requests.tenant_id 
          AND ur.role = 'manager'::public.app_role
      )
      OR
      -- User has owner role for the specific location
      EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
          AND ur.location_id = training_requests.location_id 
          AND ur.role = 'owner'::public.app_role
      )
      OR
      -- User has manager role for the specific location
      EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
          AND ur.location_id = training_requests.location_id 
          AND ur.role = 'manager'::public.app_role
      )
    )
  )
);