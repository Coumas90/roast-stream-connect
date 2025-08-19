-- Card 8: Atomic rotation stored procedure for end-to-end idempotency
-- This ensures complete transactional safety for Fudo token rotations

-- 1. Add rotation_id column to pos_credentials if missing
ALTER TABLE public.pos_credentials 
  ADD COLUMN IF NOT EXISTS rotation_id uuid;

-- 2. Create atomic rotation procedure
CREATE OR REPLACE FUNCTION public.execute_atomic_rotation(
  p_location_id uuid,
  p_provider app_pos_provider,
  p_rotation_id uuid,
  p_new_token_encrypted text,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS TABLE(
  operation_result text,
  rows_affected integer,
  token_id uuid,
  is_idempotent boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token_id uuid;
  v_rows_affected integer := 0;
  v_is_idempotent boolean := false;
  v_existing_rotation_id uuid;
BEGIN
  -- Check if this rotation_id was already processed
  SELECT rotation_id INTO v_existing_rotation_id
  FROM public.pos_credentials
  WHERE location_id = p_location_id 
    AND provider = p_provider;

  -- If rotation_id matches, this is an idempotent retry
  IF v_existing_rotation_id = p_rotation_id THEN
    v_is_idempotent := true;
    SELECT pc.rotation_attempt_id INTO v_token_id
    FROM public.pos_provider_credentials ppc
    JOIN public.pos_credentials pc ON pc.location_id = ppc.location_id AND pc.provider = ppc.provider
    WHERE ppc.location_id = p_location_id AND ppc.provider = p_provider;
    
    RETURN QUERY SELECT 'idempotent'::text, 0, v_token_id, v_is_idempotent;
    RETURN;
  END IF;

  -- Perform atomic swap in pos_provider_credentials
  UPDATE public.pos_provider_credentials
  SET 
    ciphertext = p_new_token_encrypted,
    rotation_attempt_id = p_rotation_id,
    status = 'active',
    last_verified_at = now(),
    updated_at = now()
  WHERE provider = p_provider
    AND location_id = p_location_id
    AND (rotation_attempt_id IS DISTINCT FROM p_rotation_id);

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  
  IF v_rows_affected = 0 THEN
    -- Another concurrent operation with same rotation_id won
    v_is_idempotent := true;
    RETURN QUERY SELECT 'concurrent_idempotent'::text, v_rows_affected, NULL::uuid, v_is_idempotent;
    RETURN;
  END IF;

  -- Get the token_id that was updated
  SELECT rotation_attempt_id INTO v_token_id
  FROM public.pos_provider_credentials
  WHERE location_id = p_location_id AND provider = p_provider;

  -- Update pos_credentials with rotation metadata
  UPDATE public.pos_credentials
  SET 
    rotation_id = p_rotation_id,
    rotation_status = 'rotated',
    rotation_attempt_id = p_rotation_id,
    last_rotation_at = now(),
    expires_at = COALESCE(p_expires_at, expires_at),
    consecutive_rotation_failures = 0,
    next_attempt_at = NULL,
    updated_at = now()
  WHERE location_id = p_location_id AND provider = p_provider;

  RETURN QUERY SELECT 'rotated'::text, v_rows_affected, v_token_id, v_is_idempotent;
END;
$$;

-- 3. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.execute_atomic_rotation(uuid, app_pos_provider, uuid, text, timestamptz) TO service_role;

-- 4. Add index for rotation_id lookups
CREATE INDEX IF NOT EXISTS pos_credentials_rotation_id_idx 
  ON public.pos_credentials(location_id, provider, rotation_id);

-- 5. Add index for concurrent rotation checks
CREATE INDEX IF NOT EXISTS pos_provider_credentials_rotation_attempt_idx
  ON public.pos_provider_credentials(location_id, provider, rotation_attempt_id);