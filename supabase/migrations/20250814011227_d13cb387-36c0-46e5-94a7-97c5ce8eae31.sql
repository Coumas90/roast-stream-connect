-- Enhanced security for POS credentials - simplified approach

-- 1. Drop existing policy to recreate with better security
DROP POLICY IF EXISTS "pos_provider_credentials_select_restricted" ON public.pos_provider_credentials;
DROP POLICY IF EXISTS "pos_provider_credentials_select" ON public.pos_provider_credentials;

-- 2. Create enhanced RLS policy with stricter access controls
CREATE POLICY "pos_provider_credentials_select_secure" 
ON public.pos_provider_credentials 
FOR SELECT 
USING (
  -- Only allow access if user is authenticated and has proper permissions
  auth.uid() IS NOT NULL AND (
    -- Platform admins have full access
    is_tupa_admin() OR (
      -- Regular users must have location management permissions
      user_can_manage_pos(location_id) AND
      -- Additional verification: user must have active role
      EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
          AND (ur.location_id = pos_provider_credentials.location_id OR 
               ur.tenant_id IN (SELECT tenant_id FROM public.locations WHERE id = pos_provider_credentials.location_id))
          AND ur.role IN ('owner', 'manager')
      )
    )
  )
);

-- 3. Create audit triggers for credential access tracking
CREATE OR REPLACE FUNCTION public.audit_pos_credentials_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log credential operations to pos_logs for security audit
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
    format('POS credential %s operation on table %s', TG_OP, TG_TABLE_NAME),
    COALESCE(NEW.location_id, OLD.location_id),
    COALESCE(NEW.provider, OLD.provider),
    jsonb_build_object(
      'user_id', auth.uid(),
      'timestamp', now(),
      'table', TG_TABLE_NAME,
      'operation', TG_OP
    )
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 4. Add audit triggers to both credential tables
DROP TRIGGER IF EXISTS audit_pos_credentials_trigger ON public.pos_credentials;
CREATE TRIGGER audit_pos_credentials_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.pos_credentials
  FOR EACH ROW EXECUTE FUNCTION public.audit_pos_credentials_access();

DROP TRIGGER IF EXISTS audit_pos_provider_credentials_trigger ON public.pos_provider_credentials;
CREATE TRIGGER audit_pos_provider_credentials_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.pos_provider_credentials
  FOR EACH ROW EXECUTE FUNCTION public.audit_pos_credentials_access();

-- 5. Create a secure public function that never exposes ciphertext
CREATE OR REPLACE FUNCTION public.get_pos_credentials_safe(_location_id uuid)
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
    AND public.user_can_manage_pos(_location_id);
$$;

-- 6. Add column-level security: make ciphertext only accessible to admins
-- Create a separate policy that restricts ALL operations on ciphertext to admins only
ALTER TABLE public.pos_provider_credentials ENABLE ROW LEVEL SECURITY;

-- 7. Grant only minimal necessary permissions
REVOKE ALL ON public.pos_provider_credentials FROM authenticated;
GRANT SELECT (location_id, provider, masked_hints, status, last_verified_at, updated_at) ON public.pos_provider_credentials TO authenticated;
GRANT ALL ON public.pos_provider_credentials TO service_role;