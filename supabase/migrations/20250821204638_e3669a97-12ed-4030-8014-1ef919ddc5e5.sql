-- Create cron job for proactive alerts monitoring
-- Run every 15 minutes to check system health and send proactive alerts

SELECT cron.schedule(
  'proactive-alerts-monitor',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://ipjidjijilhpblxrnaeg.supabase.co/functions/v1/proactive-alerts',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.pos_sync_job_token') || '"}'::jsonb,
      body := jsonb_build_object(
        'timestamp', now(),
        'trigger', 'cron'
      )
    ) as request_id;
  $$
);

-- Create alert configuration table for dynamic alert rules
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id text PRIMARY KEY,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  alert_type text NOT NULL, -- 'health_score', 'expiration', 'mttr', 'circuit_breaker'
  threshold_value numeric,
  threshold_operator text DEFAULT '>=' CHECK (threshold_operator IN ('>', '>=', '<', '<=', '=')),
  cooldown_minutes integer NOT NULL DEFAULT 60,
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  channels jsonb DEFAULT '["slack", "email"]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on alert_rules
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

-- Only platform admins can manage alert rules
CREATE POLICY "alert_rules_admin_only" 
ON public.alert_rules 
FOR ALL 
USING (public.is_tupa_admin()) 
WITH CHECK (public.is_tupa_admin());

-- Insert default alert rules
INSERT INTO public.alert_rules (id, name, alert_type, threshold_value, threshold_operator, cooldown_minutes, severity) VALUES
('health_score_warning', 'Health Score Warning', 'health_score', 80, '<', 60, 'warning'),
('health_score_critical', 'Health Score Critical', 'health_score', 60, '<', 30, 'error'),
('critical_expirations_high', 'High Critical Expirations', 'expiration', 5, '>=', 120, 'warning'),
('critical_expirations_urgent', 'Urgent Critical Expirations', 'expiration', 10, '>=', 60, 'error'),
('mttr_degraded', 'MTTR Degraded', 'mttr', 180, '>', 180, 'warning'),
('mttr_critical', 'MTTR Critical', 'mttr', 360, '>', 90, 'error'),
('multiple_breakers_open', 'Multiple Circuit Breakers Open', 'circuit_breaker', 2, '>=', 60, 'error')
ON CONFLICT (id) DO NOTHING;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_alert_rules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_alert_rules_updated_at
  BEFORE UPDATE ON public.alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alert_rules_timestamp();

-- Create function to get active alert rules
CREATE OR REPLACE FUNCTION public.get_active_alert_rules()
RETURNS TABLE(
  id text,
  name text,
  alert_type text,
  threshold_value numeric,
  threshold_operator text,
  cooldown_minutes integer,
  severity text,
  channels jsonb,
  metadata jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    ar.id,
    ar.name,
    ar.alert_type,
    ar.threshold_value,
    ar.threshold_operator,
    ar.cooldown_minutes,
    ar.severity,
    ar.channels,
    ar.metadata
  FROM public.alert_rules ar
  WHERE ar.enabled = true
  ORDER BY ar.severity DESC, ar.alert_type;
$$;

-- Create function to check if alert is in cooldown
CREATE OR REPLACE FUNCTION public.is_alert_in_cooldown(_alert_id text, _cooldown_minutes integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  last_triggered timestamp with time zone;
  cooldown_end timestamp with time zone;
BEGIN
  -- Only platform admins can check alert cooldowns
  IF NOT public.is_tupa_admin() THEN
    RETURN true; -- Assume in cooldown if not admin
  END IF;

  -- Get the last time this alert was triggered
  SELECT ts INTO last_triggered
  FROM public.pos_logs
  WHERE scope = 'proactive_alert'
    AND event_code = _alert_id
  ORDER BY ts DESC
  LIMIT 1;

  -- If never triggered, not in cooldown
  IF last_triggered IS NULL THEN
    RETURN false;
  END IF;

  -- Calculate cooldown end time
  cooldown_end := last_triggered + make_interval(mins => _cooldown_minutes);

  -- Return whether we're still in cooldown
  RETURN now() < cooldown_end;
END;
$$;

-- Create view for alert history with aggregations
CREATE OR REPLACE VIEW public.alert_history AS
SELECT 
  pl.event_code as alert_id,
  ar.name as alert_name,
  ar.alert_type,
  COUNT(*) as trigger_count,
  MAX(pl.ts) as last_triggered,
  MIN(pl.ts) as first_triggered,
  AVG(EXTRACT(epoch FROM (LEAD(pl.ts) OVER (PARTITION BY pl.event_code ORDER BY pl.ts) - pl.ts)) / 60) as avg_frequency_minutes
FROM public.pos_logs pl
JOIN public.alert_rules ar ON ar.id = pl.event_code
WHERE pl.scope = 'proactive_alert'
GROUP BY pl.event_code, ar.name, ar.alert_type
ORDER BY last_triggered DESC;