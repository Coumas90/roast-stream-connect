-- Fix Security Definer View issue by removing problematic views from public schema
-- The linter detects views in public schema that could expose sensitive data

-- Drop all problematic views from public schema
DROP VIEW IF EXISTS public.pos_credentials_public CASCADE;
DROP VIEW IF EXISTS public.pos_dashboard_expirations CASCADE; 
DROP VIEW IF EXISTS public.pos_dashboard_breakers CASCADE;

-- Keep the secure function but don't expose it as a view
-- The function get_pos_credentials_public() already exists and is secure

-- Create secure RPC functions for dashboard data instead of views
CREATE OR REPLACE FUNCTION public.get_dashboard_expirations()
RETURNS TABLE(
  location_id uuid,
  provider app_pos_provider,
  expires_at timestamp with time zone,
  days_until_expiry integer,
  hours_until_expiry integer,
  status text,
  rotation_status text,
  consecutive_rotation_failures integer,
  last_rotation_at timestamp with time zone,
  location_name text,
  tenant_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT 
    pc.location_id,
    pc.provider,
    pc.expires_at,
    EXTRACT(days FROM pc.expires_at - now())::integer AS days_until_expiry,
    EXTRACT(hours FROM pc.expires_at - now())::integer AS hours_until_expiry,
    pc.status,
    pc.rotation_status,
    pc.consecutive_rotation_failures,
    pc.last_rotation_at,
    l.name AS location_name,
    t.name AS tenant_name
  FROM public.pos_credentials pc
    JOIN public.locations l ON l.id = pc.location_id
    JOIN public.tenants t ON t.id = l.tenant_id
  WHERE pc.expires_at IS NOT NULL 
    AND pc.expires_at > now()
    AND (public.is_tupa_admin() OR public.user_has_location(pc.location_id))
  ORDER BY pc.expires_at;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_breakers()
RETURNS TABLE(
  provider app_pos_provider,
  location_id uuid,
  state text,
  failures integer,
  resume_at timestamp with time zone,
  window_start timestamp with time zone,
  updated_at timestamp with time zone,
  location_name text,
  tenant_name text,
  status_color text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT 
    rcb.provider,
    rcb.location_id,
    rcb.state,
    rcb.failures,
    rcb.resume_at,
    rcb.window_start,
    rcb.updated_at,
    l.name AS location_name,
    t.name AS tenant_name,
    CASE
      WHEN rcb.state = 'closed' THEN 'green'
      WHEN rcb.state = 'half-open' THEN 'amber'
      WHEN rcb.state = 'open' THEN 'red'
      ELSE 'unknown'
    END AS status_color
  FROM public.rotation_cb rcb
    LEFT JOIN public.locations l ON l.id = rcb.location_id
    LEFT JOIN public.tenants t ON t.id = l.tenant_id
  WHERE public.is_tupa_admin()
  ORDER BY rcb.updated_at DESC;
$$;

-- Grant execute permissions only to authenticated users
GRANT EXECUTE ON FUNCTION public.get_dashboard_expirations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_breakers() TO authenticated;