-- Fix security issues: Enable RLS on new tables and set search paths

-- Enable RLS on new tables
ALTER TABLE public.job_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_rotation_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies for job_locks (admin only)
CREATE POLICY "job_locks_admin_only" ON public.job_locks
FOR ALL USING (is_tupa_admin()) WITH CHECK (is_tupa_admin());

-- RLS policies for app_settings (admin only)
CREATE POLICY "app_settings_admin_only" ON public.app_settings
FOR ALL USING (is_tupa_admin()) WITH CHECK (is_tupa_admin());

-- RLS policies for pos_rotation_metrics (read for location access, admin can do all)
CREATE POLICY "pos_rotation_metrics_select_by_access" ON public.pos_rotation_metrics
FOR SELECT USING (is_tupa_admin() OR ((location_id IS NOT NULL) AND user_has_location(location_id)));

CREATE POLICY "pos_rotation_metrics_admin_write" ON public.pos_rotation_metrics
FOR INSERT, UPDATE, DELETE USING (is_tupa_admin()) WITH CHECK (is_tupa_admin());

-- Fix search path for functions
DROP FUNCTION IF EXISTS public.claim_job_lock(TEXT, INTEGER);
CREATE OR REPLACE FUNCTION public.claim_job_lock(p_name TEXT, p_ttl_seconds INTEGER)
RETURNS TABLE(acquired BOOLEAN, holder UUID) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE 
  v_holder UUID := gen_random_uuid();
  v_acquired BOOLEAN := false;
BEGIN
  INSERT INTO public.job_locks(name, lease_until, holder)
  VALUES (p_name, now() + (p_ttl_seconds || ' seconds')::interval, v_holder)
  ON CONFLICT (name) DO UPDATE
    SET lease_until = EXCLUDED.lease_until,
        holder = EXCLUDED.holder,
        updated_at = now()
  WHERE public.job_locks.lease_until < now()  -- only if expired
  RETURNING (holder = v_holder) INTO v_acquired;
  
  -- If no row was returned, the lock is still held
  IF v_acquired IS NULL THEN
    v_acquired := false;
  END IF;
  
  RETURN QUERY SELECT v_acquired, v_holder;
END$$;

-- Fix release function
DROP FUNCTION IF EXISTS public.release_job_lock(TEXT, UUID);
CREATE OR REPLACE FUNCTION public.release_job_lock(p_name TEXT, p_holder UUID)
RETURNS BOOLEAN 
LANGUAGE sql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.job_locks WHERE name = p_name AND holder = p_holder RETURNING true;
$$;

-- Fix update rotation status function
DROP FUNCTION IF EXISTS public.update_rotation_status(UUID, app_pos_provider, TEXT, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.update_rotation_status(
  p_location_id UUID,
  p_provider app_pos_provider,
  p_status TEXT,
  p_attempt_id UUID DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
  p_error_msg TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_backoff_minutes INTEGER;
BEGIN
  -- Calculate backoff based on consecutive failures
  SELECT 
    CASE 
      WHEN consecutive_rotation_failures = 0 THEN 0
      WHEN consecutive_rotation_failures = 1 THEN 60    -- 1 hour
      WHEN consecutive_rotation_failures = 2 THEN 240   -- 4 hours  
      WHEN consecutive_rotation_failures = 3 THEN 720   -- 12 hours
      ELSE 1440  -- 24 hours max
    END
  INTO v_backoff_minutes
  FROM public.pos_credentials
  WHERE location_id = p_location_id AND provider = p_provider;

  UPDATE public.pos_credentials
  SET 
    rotation_status = p_status,
    rotation_attempt_id = COALESCE(p_attempt_id, rotation_attempt_id),
    rotation_error_code = p_error_code,
    rotation_error_msg = p_error_msg,
    consecutive_rotation_failures = CASE 
      WHEN p_status = 'failed' THEN consecutive_rotation_failures + 1
      WHEN p_status = 'rotated' THEN 0
      ELSE consecutive_rotation_failures
    END,
    next_attempt_at = CASE
      WHEN p_status = 'failed' THEN now() + make_interval(mins => v_backoff_minutes)
      ELSE NULL
    END,
    updated_at = now()
  WHERE location_id = p_location_id AND provider = p_provider;
END$$;

-- Fix record metrics function
DROP FUNCTION IF EXISTS public.record_rotation_metric(UUID, app_pos_provider, UUID, TEXT, INTEGER, INTEGER, JSONB);
CREATE OR REPLACE FUNCTION public.record_rotation_metric(
  p_job_run_id UUID,
  p_provider app_pos_provider DEFAULT NULL,
  p_location_id UUID DEFAULT NULL,
  p_metric_type TEXT DEFAULT 'rotation_attempt',
  p_value INTEGER DEFAULT 1,
  p_duration_ms INTEGER DEFAULT NULL,
  p_meta JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO public.pos_rotation_metrics(job_run_id, provider, location_id, metric_type, value, duration_ms, meta)
  VALUES (p_job_run_id, p_provider, p_location_id, p_metric_type, p_value, p_duration_ms, p_meta);
$$;