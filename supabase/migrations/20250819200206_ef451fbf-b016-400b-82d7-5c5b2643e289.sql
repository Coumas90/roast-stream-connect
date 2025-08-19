-- Fix execute_atomic_rotation stored procedure issues
CREATE OR REPLACE FUNCTION public.execute_atomic_rotation(
  p_location_id uuid, 
  p_provider app_pos_provider, 
  p_rotation_id uuid, 
  p_new_token_encrypted text, 
  p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone
) 
RETURNS TABLE(operation_result text, rows_affected integer, token_id uuid, is_idempotent boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rows_affected integer := 0;
  v_is_idempotent boolean := false;
  v_existing_rotation_id uuid;
  v_correlation_id uuid;
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
    -- Return the existing correlation ID for idempotent calls
    SELECT rotation_id INTO v_correlation_id FROM public.pos_credentials 
    WHERE location_id = p_location_id AND provider = p_provider;
    RETURN QUERY SELECT 'idempotent'::text, 0, v_correlation_id, v_is_idempotent;
    RETURN;
  END IF;

  -- 🔁 Swap idempotente: sólo aplica si rotation_attempt_id es distinto
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
    SELECT rotation_id INTO v_correlation_id FROM public.pos_credentials 
    WHERE location_id = p_location_id AND provider = p_provider;
    RETURN QUERY SELECT 'concurrent_idempotent'::text, 0, v_correlation_id, v_is_idempotent;
    RETURN;
  END IF;

  -- Persistir metadata de rotación en pos_credentials (sin rotation_attempt_id)
  UPDATE public.pos_credentials
     SET rotation_id                   = p_rotation_id,
         rotation_status              = 'rotated',
         last_rotation_at             = now(),
         expires_at                   = COALESCE(p_expires_at, expires_at),
         consecutive_rotation_failures = 0,
         next_attempt_at              = NULL,
         updated_at                   = now()
   WHERE location_id = p_location_id
     AND provider    = p_provider;

  -- Return the rotation_id as correlation identifier
  RETURN QUERY SELECT 'rotated'::text, v_rows_affected, p_rotation_id, v_is_idempotent;
END;
$function$;

-- Fix run_pos_rotation to use dynamic edge_base_url and proper URL handling
CREATE OR REPLACE FUNCTION public.run_pos_rotation()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_edge_url text;
  v_token text;
  v_result jsonb;
  v_clean_url text;
BEGIN
  -- Get edge base URL from app_settings
  SELECT value INTO v_edge_url 
  FROM public.app_settings 
  WHERE key = 'edge_base_url';
  
  IF v_edge_url IS NULL THEN
    RAISE EXCEPTION 'edge_base_url not configured in app_settings';
  END IF;
  
  -- Clean URL: remove trailing slash and build proper function URL
  v_clean_url := rtrim(v_edge_url, '/') || '/functions/v1/pos-credentials-rotation';
  
  -- Get token from vault using the correct function
  v_token := vault.decrypted_secret('POS_SYNC_JOB_TOKEN');
  
  IF v_token IS NULL THEN
    RAISE EXCEPTION 'POS_SYNC_JOB_TOKEN not found in vault';
  END IF;
  
  -- Make the HTTP call with robust settings
  SELECT net.http_post(
    url := v_clean_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Job-Token', v_token
    ),
    body := jsonb_build_object(
      'timestamp', now(),
      'trigger', 'cron'
    ),
    timeout_milliseconds := 300000, -- 5 minutes
    attempts := 2
  ) INTO v_result;
  
  -- Enhanced logging with pg_net tolerance
  INSERT INTO public.pos_logs (level, scope, message, meta)
  VALUES (
    'info',
    'cron_execution',
    'POS rotation cron executed',
    jsonb_build_object(
      'request_id', COALESCE(v_result->>'request_id', v_result->>'id', 'n/a'),
      'status', v_result->>'status',
      'status_code', v_result->'status_code',
      'duration_ms', v_result->'duration_ms',
      'timestamp', now(),
      'edge_url', v_clean_url
    )
  );
  
  RETURN v_result;
END;
$function$;