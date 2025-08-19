-- FASE 1: Critical blockers

-- 1. Fix Vault function call in run_pos_rotation()
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
BEGIN
  -- Get edge base URL from app_settings
  SELECT value INTO v_edge_url 
  FROM public.app_settings 
  WHERE key = 'edge_base_url';
  
  IF v_edge_url IS NULL THEN
    RAISE EXCEPTION 'edge_base_url not configured in app_settings';
  END IF;
  
  -- Get token from vault using the correct function
  v_token := vault.decrypted_secret('POS_SYNC_JOB_TOKEN');
  
  IF v_token IS NULL THEN
    RAISE EXCEPTION 'POS_SYNC_JOB_TOKEN not found in vault';
  END IF;
  
  -- Make the HTTP call with robust settings
  SELECT net.http_post(
    url := v_edge_url || '/functions/v1/pos-credentials-rotation',
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
  
  -- Log the request ID for tracking
  INSERT INTO public.pos_logs (level, scope, message, meta)
  VALUES (
    'info',
    'cron_execution',
    'POS rotation cron executed',
    jsonb_build_object(
      'request_id', v_result->'id',
      'timestamp', now()
    )
  );
  
  RETURN v_result;
END;
$function$;

-- 2. Fix partial index - drop old and create new with correct states
DROP INDEX IF EXISTS pos_rot_sched_idx;
CREATE INDEX IF NOT EXISTS pos_rot_sched_idx
ON public.pos_credentials (rotation_status, next_attempt_at)
WHERE rotation_status IN ('pending','failed')
  AND (next_attempt_at IS NULL OR next_attempt_at <= now());

-- 3. Add idempotency column for atomic swap
ALTER TABLE public.pos_provider_credentials
  ADD COLUMN IF NOT EXISTS rotation_attempt_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS pos_cred_attempt_uniq
  ON public.pos_provider_credentials(provider, location_id, rotation_attempt_id)
  WHERE rotation_attempt_id IS NOT NULL;

-- 4. Hybrid Circuit Breaker - modify rotation_cb for (provider, location_id) granularity
ALTER TABLE public.rotation_cb DROP CONSTRAINT IF EXISTS rotation_cb_pkey;
ALTER TABLE public.rotation_cb ADD COLUMN IF NOT EXISTS location_id uuid;
ALTER TABLE public.rotation_cb ADD PRIMARY KEY (provider, location_id);

-- Index for resume_at checks
CREATE INDEX IF NOT EXISTS rotation_cb_resume_idx
  ON public.rotation_cb(resume_at) WHERE resume_at IS NOT NULL;

-- Update circuit breaker functions for hybrid granularity
CREATE OR REPLACE FUNCTION public.cb_check_state(_provider app_pos_provider, _location_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_state text;
  v_resume_at timestamptz;
  v_failures integer;
  v_now timestamptz := now();
BEGIN
  -- Get current circuit breaker state (location-specific or global)
  SELECT state, resume_at, failures INTO v_state, v_resume_at, v_failures
  FROM public.rotation_cb 
  WHERE provider = _provider 
    AND location_id IS NOT DISTINCT FROM _location_id;
  
  -- If no record exists, circuit is closed
  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'closed', 'allowed', true);
  END IF;
  
  -- If open, check if we should transition to half-open
  IF v_state = 'open' AND v_resume_at IS NOT NULL AND v_now >= v_resume_at THEN
    UPDATE public.rotation_cb 
    SET state = 'half-open', updated_at = v_now
    WHERE provider = _provider AND location_id IS NOT DISTINCT FROM _location_id;
    
    INSERT INTO public.pos_logs (level, scope, message, provider, location_id, meta)
    VALUES (
      'info',
      'circuit_breaker', 
      'Circuit breaker transitioned to half-open for testing',
      _provider,
      _location_id,
      jsonb_build_object('previous_state', 'open', 'new_state', 'half-open')
    );
    
    RETURN jsonb_build_object('state', 'half-open', 'allowed', true, 'test_mode', true);
  END IF;
  
  -- Return current state and whether requests are allowed
  RETURN jsonb_build_object(
    'state', v_state,
    'allowed', v_state IN ('closed', 'half-open'),
    'failures', v_failures,
    'resume_at', v_resume_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.cb_record_failure(_provider app_pos_provider, _location_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_window_start timestamptz;
  v_failures integer;
  v_state text;
  v_now timestamptz := now();
  v_window_duration interval := '15 minutes'::interval;
  v_lockout_duration interval := '60 minutes'::interval;
BEGIN
  -- Get or create circuit breaker record
  INSERT INTO public.rotation_cb (provider, location_id, window_start, failures, state)
  VALUES (_provider, _location_id, v_now, 0, 'closed')
  ON CONFLICT (provider, location_id) DO NOTHING;

  -- Check if we need a new window (older than 15 minutes)
  SELECT window_start, failures, state INTO v_window_start, v_failures, v_state
  FROM public.rotation_cb WHERE provider = _provider AND location_id IS NOT DISTINCT FROM _location_id;

  IF v_now - v_window_start > v_window_duration THEN
    -- Reset window
    UPDATE public.rotation_cb 
    SET window_start = v_now, failures = 1, updated_at = v_now
    WHERE provider = _provider AND location_id IS NOT DISTINCT FROM _location_id;
    v_failures := 1;
  ELSE
    -- Increment failures in current window
    UPDATE public.rotation_cb 
    SET failures = failures + 1, updated_at = v_now
    WHERE provider = _provider AND location_id IS NOT DISTINCT FROM _location_id
    RETURNING failures INTO v_failures;
  END IF;

  -- Check if we should open the circuit (≥10 failures in 15min window)
  IF v_failures >= 10 AND v_state != 'open' THEN
    UPDATE public.rotation_cb 
    SET state = 'open', resume_at = v_now + v_lockout_duration, updated_at = v_now
    WHERE provider = _provider AND location_id IS NOT DISTINCT FROM _location_id;
    
    -- Log circuit breaker opening
    INSERT INTO public.pos_logs (level, scope, message, provider, location_id, meta)
    VALUES (
      'warn',
      'circuit_breaker',
      'Circuit breaker opened due to excessive failures',
      _provider,
      _location_id,
      jsonb_build_object(
        'failures', v_failures,
        'window_start', v_window_start,
        'resume_at', v_now + v_lockout_duration,
        'threshold', 10
      )
    );
    
    RETURN jsonb_build_object('state', 'open', 'failures', v_failures, 'resume_at', v_now + v_lockout_duration);
  END IF;

  RETURN jsonb_build_object('state', v_state, 'failures', v_failures);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cb_record_success(_provider app_pos_provider, _location_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_state text;
  v_now timestamptz := now();
BEGIN
  -- Get current state
  SELECT state INTO v_state FROM public.rotation_cb 
  WHERE provider = _provider AND location_id IS NOT DISTINCT FROM _location_id;
  
  -- If half-open and success, close the circuit
  IF v_state = 'half-open' THEN
    UPDATE public.rotation_cb 
    SET state = 'closed', failures = 0, window_start = v_now, resume_at = NULL, updated_at = v_now
    WHERE provider = _provider AND location_id IS NOT DISTINCT FROM _location_id;
    
    INSERT INTO public.pos_logs (level, scope, message, provider, location_id, meta)
    VALUES (
      'info',
      'circuit_breaker',
      'Circuit breaker closed after successful half-open test',
      _provider,
      _location_id,
      jsonb_build_object('previous_state', 'half-open', 'new_state', 'closed')
    );
    
    RETURN jsonb_build_object('state', 'closed', 'transition', 'half-open -> closed');
  END IF;

  -- For closed state, just reset failure counter if it exists
  IF v_state = 'closed' THEN
    UPDATE public.rotation_cb 
    SET failures = 0, window_start = v_now, updated_at = v_now
    WHERE provider = _provider AND location_id IS NOT DISTINCT FROM _location_id AND failures > 0;
  END IF;

  RETURN jsonb_build_object('state', COALESCE(v_state, 'closed'));
END;
$function$;

-- 6. Fix selector alignment in get_fudo_credentials_expiring
CREATE OR REPLACE FUNCTION public.get_fudo_credentials_expiring(_days_ahead integer DEFAULT 3)
 RETURNS TABLE(location_id uuid, secret_ref text, expires_at timestamp with time zone, days_until_expiry integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    pc.location_id,
    pc.secret_ref,
    pc.expires_at,
    EXTRACT(days FROM (pc.expires_at - now()))::integer AS days_until_expiry
  FROM public.pos_credentials pc
  WHERE pc.provider = 'fudo'
    AND pc.expires_at IS NOT NULL
    AND pc.expires_at <= (now() + make_interval(days => _days_ahead))
    AND pc.rotation_status IN ('active','failed')
    AND (pc.next_attempt_at IS NULL OR pc.next_attempt_at <= now())
  ORDER BY pc.expires_at ASC;
$function$;

-- 8. Security grants
REVOKE ALL ON public.job_locks FROM PUBLIC;
REVOKE ALL ON public.app_settings FROM PUBLIC;
REVOKE ALL ON public.rotation_cb FROM PUBLIC;
REVOKE ALL ON public.pos_rotation_metrics FROM PUBLIC;