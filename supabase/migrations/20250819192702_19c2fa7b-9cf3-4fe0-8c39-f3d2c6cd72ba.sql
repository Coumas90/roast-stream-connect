-- Fix execute_atomic_rotation with proper schema alignment and concurrency control
-- This corrects the critical issues: proper column names, advisory locks, and correct return values

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
  v_rows_affected integer := 0;
  v_is_idempotent boolean := false;
  v_existing_rotation_id uuid;
  v_new_token_id uuid;
BEGIN
  -- 🔒 Serializar por location (evita double-swap con rotation_id distintos)
  -- Usa dos llaves para reducir colisiones: provider y location
  PERFORM pg_advisory_xact_lock(
    hashtext(p_provider::text)::bigint,
    ('x'||substr(p_location_id::text,1,16))::bit(64)::bigint
  );

  -- Si ya se persistió este rotation_id, es retry idempotente
  SELECT rotation_id INTO v_existing_rotation_id
    FROM public.pos_credentials
   WHERE location_id = p_location_id AND provider = p_provider;

  IF v_existing_rotation_id = p_rotation_id THEN
    v_is_idempotent := true;
    RETURN QUERY SELECT 'idempotent'::text, 0, NULL::uuid, v_is_idempotent;
    RETURN;
  END IF;

  -- 🔁 Swap idempotente: sólo aplica si rotation_attempt_id es distinto
  v_new_token_id := gen_random_uuid();

  UPDATE public.pos_provider_credentials
     SET ciphertext            = p_new_token_encrypted,
         rotation_attempt_id   = p_rotation_id,
         status                = 'active',
         last_verified_at      = now(),
         updated_at            = now()
   WHERE provider = p_provider
     AND location_id = p_location_id
     AND (rotation_attempt_id IS DISTINCT FROM p_rotation_id);

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    -- Otro proceso con mismo rotation_id ya aplicó: idempotente
    v_is_idempotent := true;
    RETURN QUERY SELECT 'concurrent_idempotent'::text, 0, NULL::uuid, v_is_idempotent;
    RETURN;
  END IF;

  -- Get the actual token_id that was updated
  SELECT rotation_attempt_id INTO v_new_token_id
  FROM public.pos_provider_credentials
  WHERE location_id = p_location_id AND provider = p_provider;

  -- Persistir metadata de rotación en pos_credentials
  UPDATE public.pos_credentials
     SET rotation_id                   = p_rotation_id,
         rotation_status              = 'rotated',
         rotation_attempt_id          = p_rotation_id,
         last_rotation_at             = now(),
         expires_at                   = COALESCE(p_expires_at, expires_at),
         consecutive_rotation_failures = 0,
         next_attempt_at              = NULL,
         updated_at                   = now()
   WHERE location_id = p_location_id
     AND provider    = p_provider;

  RETURN QUERY SELECT 'rotated'::text, v_rows_affected, v_new_token_id, v_is_idempotent;
END;
$$;

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION public.execute_atomic_rotation(uuid, app_pos_provider, uuid, text, timestamptz) TO service_role;