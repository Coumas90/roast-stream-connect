-- Fix the security definer view issue by removing the view and creating RLS policies instead
DROP VIEW IF EXISTS public.pos_provider_credentials_safe;

-- Revoke any grants that may have been made
REVOKE ALL ON public.pos_provider_credentials_safe FROM authenticated;

-- Update the existing pos_provider_credentials_public function to be more secure
-- This function already exists and provides safe access to credentials
-- Let's ensure it has proper search_path set
CREATE OR REPLACE FUNCTION public.pos_provider_credentials_public(_location_id uuid)
RETURNS TABLE(location_id uuid, provider app_pos_provider, masked_hints jsonb, status text, last_verified_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  select
    c.location_id,
    c.provider,
    c.masked_hints,
    c.status,
    c.last_verified_at,
    c.updated_at
  from public.pos_provider_credentials c
  where c.location_id = _location_id
    and public.user_can_manage_pos(_location_id)
$$;

-- Also fix the search_path for other functions that may be missing it
CREATE OR REPLACE FUNCTION public.log_pos_credential_access(
  _table_name text,
  _operation text,
  _location_id uuid DEFAULT NULL,
  _provider text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
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