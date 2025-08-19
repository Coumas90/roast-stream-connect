-- Phase 1: Lease Lock System
CREATE TABLE IF NOT EXISTS public.job_locks (
  name TEXT PRIMARY KEY,
  lease_until TIMESTAMPTZ NOT NULL,
  holder UUID NOT NULL DEFAULT gen_random_uuid(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Function to claim a job lock atomically
CREATE OR REPLACE FUNCTION public.claim_job_lock(p_name TEXT, p_ttl_seconds INTEGER)
RETURNS TABLE(acquired BOOLEAN, holder UUID) 
LANGUAGE plpgsql 
SECURITY DEFINER 
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

-- Function to release a job lock
CREATE OR REPLACE FUNCTION public.release_job_lock(p_name TEXT, p_holder UUID)
RETURNS BOOLEAN 
LANGUAGE sql 
SECURITY DEFINER 
AS $$
  DELETE FROM public.job_locks WHERE name = p_name AND holder = p_holder RETURNING true;
$$;

-- Phase 2: Dynamic Configuration
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default edge base URL setting
INSERT INTO public.app_settings(key, value) 
VALUES ('edge_base_url', 'https://ipjidjijilhpblxrnaeg.supabase.co')
ON CONFLICT (key) DO NOTHING;

-- Phase 3: State Machine Enhancement - Add rotation state fields to pos_credentials
ALTER TABLE public.pos_credentials 
ADD COLUMN IF NOT EXISTS rotation_status TEXT DEFAULT 'active' CHECK (rotation_status IN ('active', 'pending', 'rotating', 'rotated', 'failed')),
ADD COLUMN IF NOT EXISTS rotation_attempt_id UUID,
ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rotation_error_code TEXT,
ADD COLUMN IF NOT EXISTS rotation_error_msg TEXT,
ADD COLUMN IF NOT EXISTS consecutive_rotation_failures INTEGER DEFAULT 0;

-- Function to get credentials for rotation with lock
CREATE OR REPLACE FUNCTION public.pos_credentials_for_rotation(days_ahead INTEGER DEFAULT 7)
RETURNS TABLE(
  location_id UUID, 
  provider app_pos_provider, 
  status TEXT, 
  days_until_expiry INTEGER, 
  last_rotation_at TIMESTAMPTZ,
  rotation_attempt_id UUID
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.location_id,
    pc.provider,
    pc.status,
    EXTRACT(days FROM (pc.expires_at - now()))::INTEGER AS days_until_expiry,
    pc.last_rotation_at,
    pc.rotation_attempt_id
  FROM public.pos_credentials pc
  WHERE pc.expires_at IS NOT NULL
    AND pc.expires_at <= (now() + make_interval(days => days_ahead))
    AND pc.rotation_status IN ('active', 'failed')
    AND (pc.next_attempt_at IS NULL OR pc.next_attempt_at <= now())
    AND (is_tupa_admin() OR user_has_location(pc.location_id))
  FOR UPDATE SKIP LOCKED  -- Skip credentials being processed by other workers
  ORDER BY pc.expires_at ASC;
END$$;

-- Function to update rotation status with backoff
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

-- Update the cron job to use dynamic configuration
SELECT cron.unschedule('pos-credentials-rotation-daily');

SELECT cron.schedule(
  'pos-credentials-rotation-daily',
  '15 6 * * *',  -- 03:15 Buenos Aires (UTC-3) = 06:15 UTC
  $$
  SELECT net.http_post(
    url := (SELECT value FROM public.app_settings WHERE key = 'edge_base_url') || '/functions/v1/pos-credentials-rotation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Job-Token', vault.decrypted_secret('POS_SYNC_JOB_TOKEN')
    ),
    body := jsonb_build_object(
      'scheduled', true,
      'timestamp', now(),
      'trigger', 'cron'
    )
  );
  $$
);

-- Phase 4: Observability - Create metrics table
CREATE TABLE IF NOT EXISTS public.pos_rotation_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_run_id UUID,
  provider app_pos_provider,
  location_id UUID,
  metric_type TEXT NOT NULL, -- 'rotation_attempt', 'rotation_success', 'rotation_failure', 'backoff_scheduled'
  value INTEGER DEFAULT 1,
  duration_ms INTEGER,
  meta JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Function to record rotation metrics
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
AS $$
  INSERT INTO public.pos_rotation_metrics(job_run_id, provider, location_id, metric_type, value, duration_ms, meta)
  VALUES (p_job_run_id, p_provider, p_location_id, p_metric_type, p_value, p_duration_ms, p_meta);
$$;