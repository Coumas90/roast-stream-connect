-- Card 1.1: Credential Shielding - Security Fixes
-- Fix 1: Function search_path security (for custom functions)

-- Create secure wrapper function for token rotation with explicit search_path
CREATE OR REPLACE FUNCTION public.secure_token_rotation(
  _location_id UUID,
  _provider TEXT,
  _new_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  rotation_success BOOLEAN := FALSE;
BEGIN
  -- Secure token rotation logic with explicit schema references
  UPDATE public.pos_credentials 
  SET 
    encrypted_api_key = _new_token,
    updated_at = NOW(),
    rotation_count = COALESCE(rotation_count, 0) + 1
  WHERE location_id = _location_id 
    AND provider = _provider::public.pos_provider;
  
  GET DIAGNOSTICS rotation_success = FOUND;
  
  -- Log rotation attempt
  INSERT INTO public.pos_rotation_log (
    location_id,
    provider,
    success,
    rotated_at
  ) VALUES (
    _location_id,
    _provider::public.pos_provider,
    rotation_success,
    NOW()
  );
  
  RETURN rotation_success;
END;
$$;

-- Fix 2: Create public view for credentials without exposing ciphertext
CREATE OR REPLACE VIEW public.pos_credentials_public AS
SELECT 
  id,
  location_id,
  provider,
  created_at,
  updated_at,
  last_validated,
  rotation_count,
  -- Security: NO encrypted_api_key exposed
  CASE 
    WHEN encrypted_api_key IS NOT NULL THEN '***CONFIGURED***'
    ELSE 'NOT_CONFIGURED'
  END as api_key_status,
  CASE
    WHEN last_validated > NOW() - INTERVAL '24 hours' THEN 'VALID'
    WHEN last_validated IS NULL THEN 'UNKNOWN'
    ELSE 'STALE'
  END as validation_status
FROM public.pos_credentials;

-- Fix 3: Enable Row Level Security on credentials table
ALTER TABLE public.pos_credentials ENABLE ROW LEVEL SECURITY;

-- Create secure policy for credentials access
CREATE POLICY "Users can only access their tenant's credentials" 
ON public.pos_credentials 
FOR ALL 
USING (
  location_id IN (
    SELECT ul.location_id 
    FROM public.user_locations ul 
    WHERE ul.user_id = auth.uid()
  )
);

-- Fix 4: Create secure function for credential validation with search_path
CREATE OR REPLACE FUNCTION public.validate_pos_credentials(
  _location_id UUID,
  _provider TEXT
)
RETURNS TABLE(
  is_valid BOOLEAN,
  last_check TIMESTAMP WITH TIME ZONE,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (pc.last_validated > NOW() - INTERVAL '1 hour') as is_valid,
    pc.last_validated as last_check,
    CASE 
      WHEN pc.encrypted_api_key IS NULL THEN 'No API key configured'
      WHEN pc.last_validated IS NULL THEN 'Never validated'
      WHEN pc.last_validated < NOW() - INTERVAL '24 hours' THEN 'Validation expired'
      ELSE NULL
    END as error_message
  FROM public.pos_credentials pc
  WHERE pc.location_id = _location_id 
    AND pc.provider = _provider::public.pos_provider;
END;
$$;