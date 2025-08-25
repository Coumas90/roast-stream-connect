-- Card 1.1: Credential Shielding - Fix Security Warnings
-- Fix 1: Set search_path on existing functions that lack it

-- Update existing function search_path
CREATE OR REPLACE FUNCTION public.secure_token_rotation(
  _location_id UUID,
  _provider TEXT,
  _new_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rotation_success BOOLEAN := FALSE;
  affected_rows INTEGER;
BEGIN
  -- Secure token rotation logic with explicit schema references
  UPDATE public.pos_credentials 
  SET 
    encrypted_api_key = _new_token,
    updated_at = NOW(),
    rotation_count = COALESCE(rotation_count, 0) + 1
  WHERE location_id = _location_id 
    AND provider = _provider::public.app_pos_provider;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  rotation_success := (affected_rows > 0);
  
  -- Log rotation attempt
  INSERT INTO public.pos_logs (
    level,
    scope,
    message,
    location_id,
    provider,
    meta
  ) VALUES (
    'info',
    'credential_rotation',
    'Token rotation executed via secure function',
    _location_id,
    _provider::public.app_pos_provider,
    jsonb_build_object(
      'success', rotation_success,
      'timestamp', NOW()
    )
  );
  
  RETURN rotation_success;
END;
$$;

-- Fix 2: Create public view for credentials without exposing ciphertext
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
FROM public.pos_credentials pc;

-- Grant access to authenticated users only
GRANT SELECT ON public.pos_credentials_public TO authenticated;

-- Fix 3: Improve auth configuration for OTP and password security
-- Note: These settings need to be applied via Supabase dashboard for auth.config
-- The migration focuses on database-level security improvements

-- Fix 4: Add comprehensive credential audit logging
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

-- Apply audit trigger to credentials tables
DROP TRIGGER IF EXISTS audit_pos_credentials ON public.pos_credentials;
CREATE TRIGGER audit_pos_credentials
  AFTER INSERT OR UPDATE OR DELETE ON public.pos_credentials
  FOR EACH ROW EXECUTE FUNCTION public.audit_credential_access();

DROP TRIGGER IF EXISTS audit_pos_provider_credentials ON public.pos_provider_credentials;
CREATE TRIGGER audit_pos_provider_credentials
  AFTER INSERT OR UPDATE OR DELETE ON public.pos_provider_credentials
  FOR EACH ROW EXECUTE FUNCTION public.audit_credential_access();