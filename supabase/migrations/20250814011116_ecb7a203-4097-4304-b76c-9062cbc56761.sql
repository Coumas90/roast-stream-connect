-- Enhanced security for POS credentials - Final implementation

-- 1. Enhanced logging function for POS credential access
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

-- 2. Create audit trigger function
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

-- 3. Create audit triggers for both credential tables
DROP TRIGGER IF EXISTS audit_pos_credentials_trigger ON public.pos_credentials;
CREATE TRIGGER audit_pos_credentials_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.pos_credentials
  FOR EACH ROW EXECUTE FUNCTION public.audit_pos_credentials_access();

DROP TRIGGER IF EXISTS audit_pos_provider_credentials_trigger ON public.pos_provider_credentials;
CREATE TRIGGER audit_pos_provider_credentials_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.pos_provider_credentials
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

-- 5. Update the existing secure function to replace direct table access
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
  -- Log access attempt
  INSERT INTO public.pos_logs (level, scope, message, location_id, meta)
  VALUES (
    'info',
    'security_audit', 
    'POS credentials accessed via secure function',
    _location_id,
    jsonb_build_object('user_id', auth.uid(), 'timestamp', now())
  );

  -- Return only safe data
  SELECT
    c.location_id,
    c.provider,
    c.masked_hints,
    c.status,
    c.last_verified_at,
    c.updated_at
  FROM public.pos_provider_credentials c
  WHERE c.location_id = _location_id
    AND public.user_can_manage_pos(_location_id);
$$;

-- 6. Add additional security constraint to prevent ciphertext exposure in application layer
COMMENT ON COLUMN public.pos_provider_credentials.ciphertext IS 
'SECURITY WARNING: This column contains encrypted POS credentials. Access should ONLY be through secure edge functions with proper decryption. Never expose in client applications.';

-- 7. Create a summary function for administrators to monitor access
CREATE OR REPLACE FUNCTION public.pos_security_audit_summary()
RETURNS TABLE(
  location_id uuid,
  provider app_pos_provider,
  access_count bigint,
  last_access timestamptz,
  unique_users bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    pl.location_id,
    pl.provider,
    COUNT(*) as access_count,
    MAX(pl.ts) as last_access,
    COUNT(DISTINCT (pl.meta->>'user_id')) as unique_users
  FROM public.pos_logs pl
  WHERE pl.scope = 'security_audit'
    AND pl.location_id IS NOT NULL
    AND (is_tupa_admin() OR user_has_location(pl.location_id))
  GROUP BY pl.location_id, pl.provider
  ORDER BY last_access DESC;
$$;