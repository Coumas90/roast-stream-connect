-- Micro-adjustments for production readiness

-- 1. Fix pg_net request_id tolerance in run_pos_rotation()
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
      'edge_url', v_edge_url
    )
  );
  
  RETURN v_result;
END;
$function$;

-- 2. Create batched GC function for pos_rotation_metrics
CREATE OR REPLACE FUNCTION public.gc_pos_rotation_metrics_batched(_retention_days integer DEFAULT 90, _batch_size integer DEFAULT 5000)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff_date timestamptz;
  v_total_deleted integer := 0;
  v_batch_count integer := 0;
  v_current_batch integer;
  v_start_time timestamptz := now();
BEGIN
  -- Only platform admins can run GC
  IF NOT public.is_tupa_admin() THEN
    RAISE EXCEPTION 'Only platform administrators can run GC operations';
  END IF;

  v_cutoff_date := now() - make_interval(days => _retention_days);

  -- Batched deletion loop to avoid long locks
  LOOP
    DELETE FROM public.pos_rotation_metrics
    WHERE recorded_at < v_cutoff_date
    AND id IN (
      SELECT id FROM public.pos_rotation_metrics
      WHERE recorded_at < v_cutoff_date
      ORDER BY recorded_at
      LIMIT _batch_size
    );
    
    GET DIAGNOSTICS v_current_batch = ROW_COUNT;
    EXIT WHEN v_current_batch = 0;
    
    v_total_deleted := v_total_deleted + v_current_batch;
    v_batch_count := v_batch_count + 1;
    
    -- Small pause between batches to allow other operations
    PERFORM pg_sleep(0.1);
  END LOOP;

  -- Log the cleanup operation
  INSERT INTO public.pos_logs (level, scope, message, meta)
  VALUES (
    'info',
    'maintenance',
    'Batched GC completed for pos_rotation_metrics',
    jsonb_build_object(
      'retention_days', _retention_days,
      'batch_size', _batch_size,
      'total_deleted', v_total_deleted,
      'batch_count', v_batch_count,
      'duration_ms', EXTRACT(EPOCH FROM (now() - v_start_time)) * 1000,
      'cutoff_date', v_cutoff_date
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'total_deleted', v_total_deleted,
    'batch_count', v_batch_count,
    'duration_ms', EXTRACT(EPOCH FROM (now() - v_start_time)) * 1000
  );
END;
$function$;

-- 3. Create wrapper for automated batched GC (for cron)
CREATE OR REPLACE FUNCTION public.run_scheduled_gc()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  -- Run batched GC with default settings (90 days retention, 5000 batch size)
  SELECT public.gc_pos_rotation_metrics_batched(90, 5000) INTO v_result;
  
  RETURN v_result;
END;
$function$;

-- 4. Verify rotation_cb RLS policies are still correct after PK change
-- (This is a verification query, the policies should already be correct)
DO $$
BEGIN
  -- Check that rotation_cb still has admin-only policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'rotation_cb' 
    AND policyname = 'rotation_cb_admin_only'
  ) THEN
    RAISE EXCEPTION 'rotation_cb admin-only policy is missing';
  END IF;
END;
$$;