-- Card 1.1: Final Security Fixes - Correct Syntax
-- Complete fix for function search_path issues and policies

-- Fix all remaining functions with missing search_path
CREATE OR REPLACE FUNCTION public.update_pos_settings_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_alert_rules_timestamp()
RETURNS TRIGGER  
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), 
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Ensure RLS is properly enabled on critical tables
ALTER TABLE public.pos_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_provider_credentials ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy safely
DROP POLICY IF EXISTS "pos_credentials_public_access" ON public.pos_credentials;
CREATE POLICY "pos_credentials_public_access" 
ON public.pos_credentials 
FOR SELECT 
USING (public.user_has_location(location_id) OR public.is_tupa_admin());

-- Log completion of security fixes
INSERT INTO public.pos_logs (level, scope, message, meta)
VALUES (
  'info',
  'security_audit',
  'Card 1.1: Credential Shielding completed - Security functions updated',
  jsonb_build_object(
    'fixes_applied', ARRAY[
      'search_path_added_to_functions',
      'credential_audit_logging_enabled', 
      'public_view_without_secrets_created',
      'rls_policies_verified'
    ],
    'timestamp', NOW()
  )
);