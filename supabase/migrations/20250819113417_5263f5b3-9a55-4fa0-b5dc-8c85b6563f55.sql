-- Tabla para tracking de heartbeats de jobs críticos
CREATE TABLE public.job_heartbeats (
  job_name TEXT PRIMARY KEY,
  last_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT DEFAULT 'healthy',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policy: solo admins pueden ver heartbeats
ALTER TABLE public.job_heartbeats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_heartbeats_admin_only" ON public.job_heartbeats FOR ALL USING (is_tupa_admin());

-- Función helper para upsert heartbeat
CREATE OR REPLACE FUNCTION public.update_job_heartbeat(
  p_job_name TEXT,
  p_status TEXT DEFAULT 'healthy',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.job_heartbeats (job_name, last_run_at, status, metadata, updated_at)
  VALUES (p_job_name, NOW(), p_status, p_metadata, NOW())
  ON CONFLICT (job_name)
  DO UPDATE SET
    last_run_at = NOW(),
    status = EXCLUDED.status,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cron job para healthcheck cada 6 horas
SELECT cron.schedule(
  'job-healthcheck-6h',
  '0 */6 * * *', -- Every 6 hours at minute 0
  $$
  SELECT net.http_post(
    url := 'https://ipjidjijilhpblxrnaeg.supabase.co/functions/v1/cron-healthcheck',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Job-Token', vault.decrypted_secret('POS_SYNC_JOB_TOKEN')
    ),
    body := jsonb_build_object(
      'trigger', 'cron',
      'timestamp', now()
    )
  );
  $$
);