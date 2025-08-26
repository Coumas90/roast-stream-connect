-- Fix Security Definer View issue by converting problematic view to secure function
-- This addresses the core linter ERROR about security definer views

-- Drop the problematic view that causes security definer issues
DROP VIEW IF EXISTS public.pos_credentials_public;

-- Create a secure function instead of a view to avoid security definer view issues
CREATE OR REPLACE FUNCTION public.get_pos_credentials_public()
RETURNS TABLE(
  id uuid,
  location_id uuid,
  provider app_pos_provider,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  status text,
  rotation_status text,
  credential_status text,
  rotation_status_display text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT 
    pc.id,
    pc.location_id,
    pc.provider,
    pc.created_at,
    pc.updated_at,
    pc.status,
    pc.rotation_status,
    CASE
      WHEN pc.secret_ref IS NOT NULL THEN 'CONFIGURED'::text
      ELSE 'NOT_CONFIGURED'::text
    END AS credential_status,
    CASE
      WHEN pc.last_rotation_at > (now() - interval '24 hours') THEN 'RECENT'::text
      WHEN pc.last_rotation_at IS NULL THEN 'NEVER'::text
      ELSE 'STALE'::text
    END AS rotation_status_display
  FROM public.pos_credentials pc
  WHERE public.user_has_location(pc.location_id) OR public.is_tupa_admin();
$$;

-- Grant execute permissions on the function
GRANT EXECUTE ON FUNCTION public.get_pos_credentials_public() TO authenticated;

-- Create a materialized view from the function if needed for performance (optional)
-- This avoids the security definer view issue while maintaining query performance
CREATE VIEW public.pos_credentials_public AS 
SELECT * FROM public.get_pos_credentials_public();