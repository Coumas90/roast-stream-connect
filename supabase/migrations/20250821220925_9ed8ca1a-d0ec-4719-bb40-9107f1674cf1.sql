-- Complete chaos testing alerts with enterprise-grade alerting system

-- Insert chaos testing specific alert rules
INSERT INTO public.alert_rules (id, name, alert_type, threshold_value, threshold_operator, severity, channels, cooldown_minutes, metadata) VALUES
('chaos_test_failure_rate', 'Chaos Test Failure Rate', 'chaos_failure_rate', 20, '>=', 'critical', '["slack", "email"]', 15, '{"description": "High failure rate in chaos tests indicates system instability"}'),
('chaos_slo_violations', 'Chaos SLO Violations', 'chaos_slo_violations', 1, '>=', 'warning', '["slack"]', 30, '{"description": "SLO violations detected during chaos testing"}'),
('circuit_breaker_open', 'Circuit Breaker Open', 'circuit_breaker', 1, '>=', 'critical', '["slack", "email", "webhook"]', 60, '{"description": "Circuit breaker opened, blocking rotation attempts"}'),
('rotation_mttr_high', 'High Rotation MTTR', 'mttr_high', 60, '>=', 'warning', '["slack"]', 120, '{"description": "Mean Time To Recovery exceeds acceptable threshold"}'),
('credential_expiry_critical', 'Critical Credential Expiry', 'expiry_critical', 24, '<=', 'critical', '["slack", "email", "webhook"]', 360, '{"description": "Credentials expiring within critical timeframe"}'),
('pos_sync_consecutive_failures', 'POS Sync Consecutive Failures', 'consecutive_failures', 3, '>=', 'warning', '["slack"]', 180, '{"description": "Multiple consecutive POS sync failures detected"}')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  alert_type = EXCLUDED.alert_type,
  threshold_value = EXCLUDED.threshold_value,
  threshold_operator = EXCLUDED.threshold_operator,
  severity = EXCLUDED.severity,
  channels = EXCLUDED.channels,
  cooldown_minutes = EXCLUDED.cooldown_minutes,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- Create alert_incidents table for tracking alert history
CREATE TABLE IF NOT EXISTS public.alert_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id TEXT NOT NULL REFERENCES public.alert_rules(id),
  status TEXT NOT NULL DEFAULT 'triggered' CHECK (status IN ('triggered', 'acknowledged', 'resolved')),
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  triggered_by TEXT,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  channels_notified JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for alert_incidents
ALTER TABLE public.alert_incidents ENABLE ROW LEVEL SECURITY;

-- RLS policies for alert_incidents
CREATE POLICY "alert_incidents_admin_only" ON public.alert_incidents
  FOR ALL USING (public.is_tupa_admin())
  WITH CHECK (public.is_tupa_admin());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_alert_incidents_status ON public.alert_incidents (status);
CREATE INDEX IF NOT EXISTS idx_alert_incidents_triggered_at ON public.alert_incidents (triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_incidents_rule_id ON public.alert_incidents (alert_rule_id);

-- Function to record alert incident
CREATE OR REPLACE FUNCTION public.record_alert_incident(
  p_alert_rule_id TEXT,
  p_severity TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}',
  p_triggered_by TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_incident_id UUID;
BEGIN
  -- Only platform admins or internal services can record incidents
  IF NOT (public.is_tupa_admin() OR auth.uid() IS NULL) THEN
    RAISE EXCEPTION 'Only platform administrators can record alert incidents';
  END IF;

  INSERT INTO public.alert_incidents (
    alert_rule_id, severity, message, metadata, triggered_by
  ) VALUES (
    p_alert_rule_id, p_severity, p_message, p_metadata, p_triggered_by
  ) RETURNING id INTO v_incident_id;

  -- Log to pos_logs for centralized logging
  INSERT INTO public.pos_logs (level, scope, message, meta)
  VALUES (
    CASE p_severity 
      WHEN 'critical' THEN 'error'
      WHEN 'warning' THEN 'warn'
      ELSE 'info'
    END,
    'proactive_alert',
    p_message,
    jsonb_build_object(
      'alert_rule_id', p_alert_rule_id,
      'incident_id', v_incident_id,
      'severity', p_severity,
      'triggered_by', p_triggered_by
    ) || p_metadata
  );

  RETURN v_incident_id;
END;
$$;

-- Function to get recent alert incidents
CREATE OR REPLACE FUNCTION public.get_recent_alert_incidents(days_back INTEGER DEFAULT 7)
RETURNS TABLE(
  id UUID,
  alert_rule_id TEXT,
  rule_name TEXT,
  status TEXT,
  severity TEXT,
  message TEXT,
  triggered_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  channels_notified JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    ai.id,
    ai.alert_rule_id,
    ar.name as rule_name,
    ai.status,
    ai.severity,
    ai.message,
    ai.triggered_at,
    ai.acknowledged_at,
    ai.resolved_at,
    ai.metadata,
    ai.channels_notified
  FROM public.alert_incidents ai
  JOIN public.alert_rules ar ON ar.id = ai.alert_rule_id
  WHERE ai.triggered_at >= (now() - make_interval(days => days_back))
    AND public.is_tupa_admin()
  ORDER BY ai.triggered_at DESC;
$$;

-- Function to acknowledge alert incident
CREATE OR REPLACE FUNCTION public.acknowledge_alert_incident(p_incident_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only platform admins can acknowledge incidents
  IF NOT public.is_tupa_admin() THEN
    RETURN FALSE;
  END IF;

  UPDATE public.alert_incidents
  SET status = 'acknowledged',
      acknowledged_at = now(),
      updated_at = now()
  WHERE id = p_incident_id
    AND status = 'triggered';

  IF FOUND THEN
    INSERT INTO public.pos_logs (level, scope, message, meta)
    VALUES (
      'info', 'alert_management',
      'Alert incident acknowledged',
      jsonb_build_object(
        'incident_id', p_incident_id,
        'acknowledged_by', auth.uid(),
        'timestamp', now()
      )
    );
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Function to resolve alert incident
CREATE OR REPLACE FUNCTION public.resolve_alert_incident(p_incident_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only platform admins can resolve incidents
  IF NOT public.is_tupa_admin() THEN
    RETURN FALSE;
  END IF;

  UPDATE public.alert_incidents
  SET status = 'resolved',
      resolved_at = now(),
      updated_at = now()
  WHERE id = p_incident_id
    AND status IN ('triggered', 'acknowledged');

  IF FOUND THEN
    INSERT INTO public.pos_logs (level, scope, message, meta)
    VALUES (
      'info', 'alert_management',
      'Alert incident resolved',
      jsonb_build_object(
        'incident_id', p_incident_id,
        'resolved_by', auth.uid(),
        'timestamp', now()
      )
    );
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Trigger to update alert_incidents timestamp
CREATE TRIGGER update_alert_incidents_timestamp
  BEFORE UPDATE ON public.alert_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();