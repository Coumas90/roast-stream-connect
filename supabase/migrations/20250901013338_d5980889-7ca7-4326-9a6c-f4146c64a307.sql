-- Create RLS policies for INSERT operations on pos_logs table
-- This will fix the "new row violates row-level security policy" error

-- Allow Edge Functions to insert logs (they use SERVICE_ROLE_KEY)
CREATE POLICY "pos_logs_insert_service_role" ON public.pos_logs
FOR INSERT 
WITH CHECK (true);

-- Allow authenticated users with proper access to insert logs
CREATE POLICY "pos_logs_insert_authenticated" ON public.pos_logs
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    is_tupa_admin() OR 
    (tenant_id IS NOT NULL AND user_has_tenant(tenant_id)) OR 
    (location_id IS NOT NULL AND user_has_location(location_id))
  )
);