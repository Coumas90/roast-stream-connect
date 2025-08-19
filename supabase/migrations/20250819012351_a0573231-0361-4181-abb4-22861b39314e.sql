-- Phase 1: Critical adjustments

-- 1. Heartbeat: Add renew_job_lock function
CREATE OR REPLACE FUNCTION public.renew_job_lock(p_name text, p_holder uuid, p_ttl_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.job_locks 
  SET lease_until = now() + (p_ttl_seconds || ' seconds')::interval,
      updated_at = now()
  WHERE name = p_name 
    AND holder = p_holder 
    AND lease_until > now();
  
  RETURN FOUND;
END$function$;

-- 2. State machine performance index
CREATE INDEX IF NOT EXISTS pos_rot_sched_idx 
ON public.pos_credentials (rotation_status, next_attempt_at) 
WHERE rotation_status IN ('pending', 'retry_scheduled');

-- Create index on expires_at for candidate selection
CREATE INDEX IF NOT EXISTS pos_cred_expires_idx 
ON public.pos_credentials (expires_at) 
WHERE expires_at IS NOT NULL;

-- Phase 2: Robustness improvements

-- 4. Security definer wrapper for cron
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
  
  -- Get token from vault (using the secret name from the runbook)
  SELECT decrypted_secret INTO v_token
  FROM vault.decrypted_secrets 
  WHERE name = 'POS_SYNC_JOB_TOKEN';
  
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

-- 6. Metrics garbage collection cron job
SELECT cron.schedule(
  'cleanup-pos-rotation-metrics',
  '0 2 * * 0', -- Weekly on Sunday at 2 AM
  $$
  DELETE FROM public.pos_rotation_metrics 
  WHERE recorded_at < now() - interval '90 days';
  $$
);

-- 3. Minimal grants (revoke all, grant only to service_role)
REVOKE ALL ON FUNCTION public.claim_job_lock FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_job_lock FROM PUBLIC;
REVOKE ALL ON FUNCTION public.renew_job_lock FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_rotation_status FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_rotation_metric FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_pos_rotation FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.claim_job_lock TO service_role;
GRANT EXECUTE ON FUNCTION public.release_job_lock TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_job_lock TO service_role;
GRANT EXECUTE ON FUNCTION public.update_rotation_status TO service_role;
GRANT EXECUTE ON FUNCTION public.record_rotation_metric TO service_role;
GRANT EXECUTE ON FUNCTION public.run_pos_rotation TO service_role;

-- Update the main POS rotation cron to use the wrapper function
SELECT cron.unschedule('pos-credentials-rotation');
SELECT cron.schedule(
  'pos-credentials-rotation',
  '15 6 * * *', -- 6:15 AM daily
  $$
  SELECT public.run_pos_rotation();
  $$
);