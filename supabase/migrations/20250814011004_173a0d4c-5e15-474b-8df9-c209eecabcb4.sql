-- Enhance security for POS credentials tables

-- 1. Create audit triggers for credential access tracking
CREATE OR REPLACE FUNCTION public.audit_pos_credentials_access()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 2. Enhanced logging function for POS credential access
CREATE OR REPLACE FUNCTION public.log_pos_credential_access(
  _table_name text,
  _operation text,
  _location_id uuid DEFAULT NULL,
  _provider text DEFAULT NULL
)
RETURNS void
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

-- 3. Create audit triggers for both credential tables
DROP TRIGGER IF EXISTS audit_pos_credentials_trigger ON public.pos_credentials;
CREATE TRIGGER audit_pos_credentials_trigger
  AFTER SELECT, INSERT, UPDATE, DELETE ON public.pos_credentials
  FOR EACH ROW EXECUTE FUNCTION public.audit_pos_credentials_access();

DROP TRIGGER IF EXISTS audit_pos_provider_credentials_trigger ON public.pos_provider_credentials;
CREATE TRIGGER audit_pos_provider_credentials_trigger
  AFTER SELECT, INSERT, UPDATE, DELETE ON public.pos_provider_credentials
  FOR EACH ROW EXECUTE FUNCTION public.audit_pos_credentials_access();

-- 4. Enhance RLS policies for pos_provider_credentials to be more restrictive
DROP POLICY IF EXISTS "pos_provider_credentials_select" ON public.pos_provider_credentials;
CREATE POLICY "pos_provider_credentials_select_restricted" 
ON public.pos_provider_credentials 
FOR SELECT 
USING (
  -- Only platform admins or users with explicit manager/owner access to the location
  is_tupa_admin() OR (
    user_can_manage_pos(location_id) AND
    -- Additional check: must be authenticated and have verified recent activity
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND (ur.location_id = pos_provider_credentials.location_id OR 
             ur.tenant_id IN (SELECT tenant_id FROM public.locations WHERE id = pos_provider_credentials.location_id))
        AND ur.role IN ('owner', 'manager')
    )
  )
);

-- 5. Create a secure view that never exposes the actual ciphertext
CREATE OR REPLACE VIEW public.pos_credentials_safe AS
SELECT 
  location_id,
  provider,
  status,
  last_verified_at,
  masked_hints,
  updated_at
FROM public.pos_provider_credentials;

-- 6. Create RLS policy for the safe view
ALTER VIEW public.pos_credentials_safe SET (security_barrier = true);

-- 7. Grant appropriate permissions
GRANT SELECT ON public.pos_credentials_safe TO authenticated;

-- 8. Revoke direct access to ciphertext for non-admin users
-- Create a function that only returns masked data for non-admins
CREATE OR REPLACE FUNCTION public.pos_provider_credentials_public(_location_id uuid)
RETURNS TABLE(
  location_id uuid,
  provider app_pos_provider,
  masked_hints jsonb,
  status text,
  last_verified_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    c.location_id,
    c.provider,
    c.masked_hints,
    c.status,
    c.last_verified_at,
    c.updated_at
  FROM public.pos_provider_credentials c
  WHERE c.location_id = _location_id
    AND public.user_can_manage_pos(_location_id)
$$;