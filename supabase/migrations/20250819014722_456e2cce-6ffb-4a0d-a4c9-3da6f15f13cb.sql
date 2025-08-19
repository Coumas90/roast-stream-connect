-- Create Circuit Breaker table for persistent state management
CREATE TABLE public.rotation_cb (
  provider app_pos_provider PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  failures integer NOT NULL DEFAULT 0,
  state text NOT NULL DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half-open')),
  resume_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add index for efficient queries by resume_at
CREATE INDEX idx_rotation_cb_resume_at ON public.rotation_cb(resume_at) WHERE resume_at IS NOT NULL;

-- RLS policies - admin only access
ALTER TABLE public.rotation_cb ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rotation_cb_admin_only" ON public.rotation_cb
  FOR ALL
  TO authenticated
  USING (is_tupa_admin())
  WITH CHECK (is_tupa_admin());

-- Circuit Breaker utility functions
CREATE OR REPLACE FUNCTION public.cb_record_failure(_provider app_pos_provider)
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
  INSERT INTO public.rotation_cb (provider, window_start, failures, state)
  VALUES (_provider, v_now, 0, 'closed')
  ON CONFLICT (provider) DO NOTHING;

  -- Check if we need a new window (older than 15 minutes)
  SELECT window_start, failures, state INTO v_window_start, v_failures, v_state
  FROM public.rotation_cb WHERE provider = _provider;

  IF v_now - v_window_start > v_window_duration THEN
    -- Reset window
    UPDATE public.rotation_cb 
    SET window_start = v_now, failures = 1, updated_at = v_now
    WHERE provider = _provider;
    v_failures := 1;
  ELSE
    -- Increment failures in current window
    UPDATE public.rotation_cb 
    SET failures = failures + 1, updated_at = v_now
    WHERE provider = _provider
    RETURNING failures INTO v_failures;
  END IF;

  -- Check if we should open the circuit (≥10 failures in 15min window)
  IF v_failures >= 10 AND v_state != 'open' THEN
    UPDATE public.rotation_cb 
    SET state = 'open', resume_at = v_now + v_lockout_duration, updated_at = v_now
    WHERE provider = _provider;
    
    -- Log circuit breaker opening
    INSERT INTO public.pos_logs (level, scope, message, provider, meta)
    VALUES (
      'warn',
      'circuit_breaker',
      'Circuit breaker opened due to excessive failures',
      _provider,
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

CREATE OR REPLACE FUNCTION public.cb_record_success(_provider app_pos_provider)
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
  SELECT state INTO v_state FROM public.rotation_cb WHERE provider = _provider;
  
  -- If half-open and success, close the circuit
  IF v_state = 'half-open' THEN
    UPDATE public.rotation_cb 
    SET state = 'closed', failures = 0, window_start = v_now, resume_at = NULL, updated_at = v_now
    WHERE provider = _provider;
    
    INSERT INTO public.pos_logs (level, scope, message, provider, meta)
    VALUES (
      'info',
      'circuit_breaker',
      'Circuit breaker closed after successful half-open test',
      _provider,
      jsonb_build_object('previous_state', 'half-open', 'new_state', 'closed')
    );
    
    RETURN jsonb_build_object('state', 'closed', 'transition', 'half-open -> closed');
  END IF;

  -- For closed state, just reset failure counter if it exists
  IF v_state = 'closed' THEN
    UPDATE public.rotation_cb 
    SET failures = 0, window_start = v_now, updated_at = v_now
    WHERE provider = _provider AND failures > 0;
  END IF;

  RETURN jsonb_build_object('state', COALESCE(v_state, 'closed'));
END;
$function$;

CREATE OR REPLACE FUNCTION public.cb_check_state(_provider app_pos_provider)
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
  -- Get current circuit breaker state
  SELECT state, resume_at, failures INTO v_state, v_resume_at, v_failures
  FROM public.rotation_cb WHERE provider = _provider;
  
  -- If no record exists, circuit is closed
  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'closed', 'allowed', true);
  END IF;
  
  -- If open, check if we should transition to half-open
  IF v_state = 'open' AND v_resume_at IS NOT NULL AND v_now >= v_resume_at THEN
    UPDATE public.rotation_cb 
    SET state = 'half-open', updated_at = v_now
    WHERE provider = _provider;
    
    INSERT INTO public.pos_logs (level, scope, message, provider, meta)
    VALUES (
      'info',
      'circuit_breaker', 
      'Circuit breaker transitioned to half-open for testing',
      _provider,
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

-- Function to get credentials expiring soon for Fudo
CREATE OR REPLACE FUNCTION public.get_fudo_credentials_expiring(_days_ahead integer DEFAULT 3)
RETURNS TABLE(
  location_id uuid,
  secret_ref text,
  expires_at timestamptz,
  days_until_expiry integer
)
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
    AND pc.status = 'active'
  ORDER BY pc.expires_at ASC;
$function$;