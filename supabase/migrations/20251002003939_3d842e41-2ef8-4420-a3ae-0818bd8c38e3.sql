-- Add RLS policies for location_stock to allow managers/owners to upsert hopper configurations
-- Currently only admins can modify location_stock, this blocks regular users from configuring hoppers

-- Policy to allow INSERT for owners/managers with location access
CREATE POLICY "location_stock_insert_manager"
ON public.location_stock
FOR INSERT
WITH CHECK (
  (user_has_location(location_id) AND (
    has_role(auth.uid(), 'owner'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  )) OR is_tupa_admin()
);

-- Policy to allow UPDATE for owners/managers with location access
CREATE POLICY "location_stock_update_manager"
ON public.location_stock
FOR UPDATE
USING (
  (user_has_location(location_id) AND (
    has_role(auth.uid(), 'owner'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  )) OR is_tupa_admin()
)
WITH CHECK (
  (user_has_location(location_id) AND (
    has_role(auth.uid(), 'owner'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  )) OR is_tupa_admin()
);