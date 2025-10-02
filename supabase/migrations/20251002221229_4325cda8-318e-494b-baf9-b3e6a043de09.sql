-- ============================================================================
-- MIGRATION: Restrict barista access to sensitive data via RLS policies
-- ============================================================================
-- Purpose: Prevent barista/coffee_master roles from accessing inventory,
--          orders, and consumption data directly from database
-- Tables affected: location_stock, order_proposals, consumptions, consumption_daily
-- ============================================================================

-- 1. Update location_stock RLS policies
-- ============================================================================
-- Drop existing select policy
DROP POLICY IF EXISTS "location_stock_select_by_access" ON public.location_stock;

-- Create new restrictive policy requiring owner/manager/admin roles
CREATE POLICY "location_stock_select_owner_manager_admin"
ON public.location_stock
FOR SELECT
USING (
  (user_has_location(location_id) AND (
    has_role(auth.uid(), 'owner'::public.app_role) OR 
    has_role(auth.uid(), 'manager'::public.app_role)
  )) 
  OR is_tupa_admin()
);

-- 2. Update order_proposals RLS policies
-- ============================================================================
-- Drop existing select policy
DROP POLICY IF EXISTS "orders_select_by_location" ON public.order_proposals;

-- Create new restrictive policy
CREATE POLICY "orders_select_owner_manager_admin"
ON public.order_proposals
FOR SELECT
USING (
  (user_has_location(location_id) AND (
    has_role(auth.uid(), 'owner'::public.app_role) OR 
    has_role(auth.uid(), 'manager'::public.app_role)
  )) 
  OR is_tupa_admin()
);

-- 3. Update consumptions RLS policies
-- ============================================================================
-- Drop existing select policy
DROP POLICY IF EXISTS "consumptions_select_by_access" ON public.consumptions;

-- Create new restrictive policy
CREATE POLICY "consumptions_select_owner_manager_admin"
ON public.consumptions
FOR SELECT
USING (
  is_tupa_admin() OR 
  (user_has_tenant(client_id) AND (
    has_role(auth.uid(), 'owner'::public.app_role) OR 
    has_role(auth.uid(), 'manager'::public.app_role)
  )) OR 
  (user_has_location(location_id) AND (
    has_role(auth.uid(), 'owner'::public.app_role) OR 
    has_role(auth.uid(), 'manager'::public.app_role)
  ))
);

-- 4. Update consumption_daily RLS policies
-- ============================================================================
-- Drop existing select policy
DROP POLICY IF EXISTS "consumption_select_by_location" ON public.consumption_daily;

-- Create new restrictive policy
CREATE POLICY "consumption_daily_select_owner_manager_admin"
ON public.consumption_daily
FOR SELECT
USING (
  (user_has_location(location_id) AND (
    has_role(auth.uid(), 'owner'::public.app_role) OR 
    has_role(auth.uid(), 'manager'::public.app_role)
  )) 
  OR is_tupa_admin()
);

-- 5. Log security change
-- ============================================================================
INSERT INTO public.pos_logs (level, scope, message, meta)
VALUES (
  'info',
  'security',
  'RLS policies updated to restrict barista access to sensitive tables',
  jsonb_build_object(
    'tables_affected', ARRAY['location_stock', 'order_proposals', 'consumptions', 'consumption_daily'],
    'roles_allowed', ARRAY['owner', 'manager', 'tupa_admin'],
    'migration_timestamp', now()
  )
);