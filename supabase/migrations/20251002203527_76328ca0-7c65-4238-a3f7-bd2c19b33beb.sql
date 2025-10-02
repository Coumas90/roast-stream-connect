-- Add missing DELETE policy for location_stock
-- Allow managers and owners to delete stock from their locations
CREATE POLICY "location_stock_delete_manager"
ON public.location_stock
FOR DELETE
USING (
  (user_has_location(location_id) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  OR is_tupa_admin()
);