-- Card 1.1: Critical Security Fixes - Round 2
-- Fix ERROR: Security Definer View and remaining function search_path issues

-- Fix 1: Replace SECURITY DEFINER view with regular view
DROP VIEW IF EXISTS public.pos_credentials_public;

CREATE VIEW public.pos_credentials_public AS
SELECT 
  pc.id,
  pc.location_id,
  pc.provider,
  pc.created_at,
  pc.updated_at,
  pc.status,
  pc.rotation_status,
  -- Security: NO secret_ref or encrypted data exposed
  CASE 
    WHEN pc.secret_ref IS NOT NULL THEN 'CONFIGURED'
    ELSE 'NOT_CONFIGURED'
  END as credential_status,
  CASE
    WHEN pc.last_rotation_at > NOW() - INTERVAL '24 hours' THEN 'RECENT'
    WHEN pc.last_rotation_at IS NULL THEN 'NEVER'
    ELSE 'STALE'
  END as rotation_status_display
FROM public.pos_credentials pc
WHERE public.user_has_location(pc.location_id) OR public.is_tupa_admin();

-- Fix 2: Add search_path to remaining functions that need it
-- Update the audit function to have proper search_path
CREATE OR REPLACE FUNCTION public.audit_credential_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log all credential table access  
  INSERT INTO public.pos_logs (
    level,
    scope,
    message,
    location_id,
    provider,
    meta
  ) VALUES (
    'info',
    'credential_audit',
    format('Credential %s operation performed', TG_OP),
    COALESCE(NEW.location_id, OLD.location_id),
    COALESCE(NEW.provider, OLD.provider),
    jsonb_build_object(
      'operation', TG_OP,
      'user_id', auth.uid(),
      'timestamp', NOW(),
      'table', TG_TABLE_NAME
    )
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix 3: Update other functions that may be missing search_path
-- Check and update any trigger functions
CREATE OR REPLACE FUNCTION public.update_credential_rotation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.secret_ref IS DISTINCT FROM NEW.secret_ref THEN
    NEW.last_rotation_at = now();
    NEW.status = COALESCE(NEW.status, 'active');
  END IF;
  RETURN NEW;
END;
$$;