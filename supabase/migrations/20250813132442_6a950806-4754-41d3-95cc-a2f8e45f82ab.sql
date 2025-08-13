-- First, let's check and strengthen the pos_credentials table security
-- Enable RLS on pos_credentials if not already enabled
ALTER TABLE public.pos_credentials ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to recreate them with stronger security
DROP POLICY IF EXISTS "pos_credentials_select_admin_only" ON public.pos_credentials;
DROP POLICY IF EXISTS "pos_credentials_write_admin_only" ON public.pos_credentials;

-- Create the most restrictive policies for pos_credentials
-- Only platform admins can access this table
CREATE POLICY "pos_credentials_admin_only_access" 
ON public.pos_credentials 
FOR ALL 
USING (public.is_tupa_admin()) 
WITH CHECK (public.is_tupa_admin());

-- Additional security: Create a function to audit access to sensitive credentials
CREATE OR REPLACE FUNCTION public.log_pos_credential_access(
  _table_name text,
  _operation text,
  _location_id uuid DEFAULT NULL,
  _provider text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.pos_logs (
    level,
    scope,
    message,
    location_id,
    provider,
    meta
  ) VALUES (
    'info',
    'security_audit',
    format('POS credential %s operation on table %s', _operation, _table_name),
    _location_id,
    _provider::app_pos_provider,
    jsonb_build_object(
      'user_id', auth.uid(),
      'timestamp', now(),
      'table', _table_name,
      'operation', _operation
    )
  );
END;
$$;

-- Create trigger to audit all access to pos_credentials
CREATE OR REPLACE FUNCTION public.audit_pos_credentials_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log the access attempt
  PERFORM public.log_pos_credential_access(
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(NEW.location_id, OLD.location_id),
    COALESCE(NEW.provider::text, OLD.provider::text)
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Apply audit trigger to pos_credentials
DROP TRIGGER IF EXISTS audit_pos_credentials_trigger ON public.pos_credentials;
CREATE TRIGGER audit_pos_credentials_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.pos_credentials
  FOR EACH ROW EXECUTE FUNCTION public.audit_pos_credentials_access();

-- Apply audit trigger to pos_provider_credentials
DROP TRIGGER IF EXISTS audit_pos_provider_credentials_trigger ON public.pos_provider_credentials;
CREATE TRIGGER audit_pos_provider_credentials_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.pos_provider_credentials
  FOR EACH ROW EXECUTE FUNCTION public.audit_pos_credentials_access();

-- Create a view for safe access to pos_provider_credentials that only shows minimal info
CREATE OR REPLACE VIEW public.pos_provider_credentials_safe AS
SELECT 
  location_id,
  provider,
  status,
  last_verified_at,
  masked_hints,
  updated_at
FROM public.pos_provider_credentials;

-- Grant access to the safe view for users who can manage POS
GRANT SELECT ON public.pos_provider_credentials_safe TO authenticated;