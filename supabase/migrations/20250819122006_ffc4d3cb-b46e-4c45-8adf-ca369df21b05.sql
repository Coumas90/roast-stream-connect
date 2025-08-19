-- Production-ready improvements for job heartbeats and healthcheck system

-- 1. Add index for efficient heartbeat queries
CREATE INDEX IF NOT EXISTS job_heartbeats_last_run_at_idx 
  ON public.job_heartbeats(last_run_at);

-- 2. Add last_alert_at column for antispam
ALTER TABLE public.job_heartbeats 
  ADD COLUMN IF NOT EXISTS last_alert_at TIMESTAMPTZ;

-- 3. Add index for last_alert_at
CREATE INDEX IF NOT EXISTS job_heartbeats_last_alert_at_idx 
  ON public.job_heartbeats(last_alert_at);

-- 4. Update function with proper security settings
CREATE OR REPLACE FUNCTION public.update_job_heartbeat(
  p_job_name text, 
  p_status text DEFAULT 'healthy', 
  p_metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.job_heartbeats(job_name, last_run_at, status, metadata, updated_at)
  VALUES (p_job_name, now(), p_status, p_metadata, now())
  ON CONFLICT (job_name) 
  DO UPDATE SET
    last_run_at = now(),
    status = EXCLUDED.status,
    metadata = EXCLUDED.metadata,
    updated_at = now();
END;
$$;

-- 5. Grant execute permissions to service_role
GRANT EXECUTE ON FUNCTION public.update_job_heartbeat(text, text, jsonb) TO service_role;

-- 6. Update RLS policy with WITH CHECK for symmetry
DROP POLICY IF EXISTS job_heartbeats_admin_only ON public.job_heartbeats;

CREATE POLICY job_heartbeats_admin_only 
  ON public.job_heartbeats
  FOR ALL
  USING (is_tupa_admin())
  WITH CHECK (is_tupa_admin());

-- 7. Setup cron job using dynamic edge_base_url (example SQL for reference)
-- This should be run manually after migration:
/*
SELECT cron.schedule(
  'cron-healthcheck-every-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := RTRIM((SELECT value FROM public.app_settings WHERE key = 'edge_base_url'), '/') || '/functions/v1/cron-healthcheck',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"timestamp": "' || now() || '"}'::jsonb
  ) as request_id;
  $$
);
*/