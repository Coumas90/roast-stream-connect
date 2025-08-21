-- Chaos Testing Infrastructure for POS Rotation System
-- Tables for tracking and configuring chaos test scenarios

-- Table for chaos test run tracking
CREATE TABLE public.chaos_test_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_name TEXT NOT NULL,
  test_type TEXT NOT NULL, -- 'fudo_500', 'rate_limit_429', 'timeout', 'overload'
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  provider app_pos_provider NOT NULL DEFAULT 'fudo',
  target_location_id UUID,
  configuration JSONB NOT NULL DEFAULT '{}',
  results JSONB NOT NULL DEFAULT '{}',
  violations JSONB[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for chaos scenario configurations
CREATE TABLE public.chaos_scenarios (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  test_type TEXT NOT NULL,
  provider app_pos_provider NOT NULL DEFAULT 'fudo',
  enabled BOOLEAN NOT NULL DEFAULT true,
  configuration JSONB NOT NULL DEFAULT '{}',
  success_criteria JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for chaos test metrics and assertions
CREATE TABLE public.chaos_test_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_run_id UUID NOT NULL REFERENCES chaos_test_runs(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_type TEXT NOT NULL, -- 'counter', 'gauge', 'timer', 'assertion'
  value NUMERIC NOT NULL,
  unit TEXT,
  passed BOOLEAN,
  expected_value NUMERIC,
  threshold_operator TEXT, -- '>', '<', '>=', '<=', '='
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.chaos_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chaos_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chaos_test_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin only access
CREATE POLICY "chaos_test_runs_admin_only" ON public.chaos_test_runs
  FOR ALL USING (public.is_tupa_admin())
  WITH CHECK (public.is_tupa_admin());

CREATE POLICY "chaos_scenarios_admin_only" ON public.chaos_scenarios
  FOR ALL USING (public.is_tupa_admin())
  WITH CHECK (public.is_tupa_admin());

CREATE POLICY "chaos_test_metrics_admin_only" ON public.chaos_test_metrics
  FOR ALL USING (public.is_tupa_admin())
  WITH CHECK (public.is_tupa_admin());

-- Insert default chaos scenarios
INSERT INTO public.chaos_scenarios (id, name, description, test_type, configuration, success_criteria) VALUES
('fudo_500_errors', 'Fudo 500 Server Errors', 'Simulate Fudo API returning 500 errors consistently', 'fudo_500', 
 '{"error_rate": 1.0, "duration_minutes": 5, "target_endpoints": ["token", "me"]}'::jsonb,
 '{"circuit_breaker_opens": true, "max_failures_before_open": 10, "no_credential_corruption": true}'::jsonb),

('rate_limit_429', 'Rate Limit 429 with Backoff', 'Simulate 429 responses with exponential backoff testing', 'rate_limit_429',
 '{"error_rate": 0.8, "max_retries": 3, "base_delay_ms": 1000, "max_delay_ms": 8000}'::jsonb,
 '{"respects_backoff": true, "max_retry_attempts": 3, "no_rate_limit_violations": true}'::jsonb),

('timeout_30s', 'Network Timeouts (30s)', 'Simulate network timeouts with retry behavior', 'timeout',
 '{"timeout_ms": 30000, "retry_count": 2, "failure_rate": 0.7}'::jsonb,
 '{"respects_timeout": true, "max_retries": 2, "no_hanging_requests": true}'::jsonb),

('rotation_overload', 'Rotation Rate Limiting', 'Test rotation rate limits per minute/hour', 'overload',
 '{"requests_per_minute": 100, "duration_minutes": 10, "burst_size": 20}'::jsonb,
 '{"rate_limit_respected": true, "max_rpm_not_exceeded": true, "cooldown_respected": true}'::jsonb);

-- Function to start a chaos test run
CREATE OR REPLACE FUNCTION public.start_chaos_test(
  p_scenario_id TEXT,
  p_target_location_id UUID DEFAULT NULL,
  p_custom_config JSONB DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_scenario chaos_scenarios%ROWTYPE;
  v_test_run_id UUID;
  v_merged_config JSONB;
BEGIN
  -- Only platform admins can run chaos tests
  IF NOT public.is_tupa_admin() THEN
    RAISE EXCEPTION 'Only platform administrators can run chaos tests';
  END IF;

  -- Get scenario configuration
  SELECT * INTO v_scenario FROM public.chaos_scenarios 
  WHERE id = p_scenario_id AND enabled = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scenario % not found or disabled', p_scenario_id;
  END IF;

  -- Merge custom config with scenario config
  v_merged_config := v_scenario.configuration || COALESCE(p_custom_config, '{}');

  -- Create test run record
  INSERT INTO public.chaos_test_runs (
    scenario_name, test_type, provider, target_location_id, 
    configuration, created_by
  ) VALUES (
    v_scenario.name, v_scenario.test_type, v_scenario.provider, 
    p_target_location_id, v_merged_config, auth.uid()
  ) RETURNING id INTO v_test_run_id;

  -- Log test start
  INSERT INTO public.pos_logs (level, scope, message, provider, location_id, meta)
  VALUES (
    'info', 'chaos_testing', 
    format('Chaos test started: %s', v_scenario.name),
    v_scenario.provider, p_target_location_id,
    jsonb_build_object(
      'test_run_id', v_test_run_id,
      'scenario_id', p_scenario_id,
      'configuration', v_merged_config
    )
  );

  RETURN v_test_run_id;
END;
$$;

-- Function to record chaos test metrics
CREATE OR REPLACE FUNCTION public.record_chaos_metric(
  p_test_run_id UUID,
  p_metric_name TEXT,
  p_metric_type TEXT,
  p_value NUMERIC,
  p_expected_value NUMERIC DEFAULT NULL,
  p_threshold_operator TEXT DEFAULT NULL,
  p_unit TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_passed BOOLEAN := NULL;
BEGIN
  -- Only platform admins can record metrics
  IF NOT public.is_tupa_admin() THEN
    RETURN FALSE;
  END IF;

  -- Calculate if metric passed (if criteria provided)
  IF p_expected_value IS NOT NULL AND p_threshold_operator IS NOT NULL THEN
    v_passed := CASE p_threshold_operator
      WHEN '>' THEN p_value > p_expected_value
      WHEN '<' THEN p_value < p_expected_value
      WHEN '>=' THEN p_value >= p_expected_value
      WHEN '<=' THEN p_value <= p_expected_value
      WHEN '=' THEN p_value = p_expected_value
      ELSE NULL
    END;
  END IF;

  -- Insert metric
  INSERT INTO public.chaos_test_metrics (
    test_run_id, metric_name, metric_type, value, unit,
    passed, expected_value, threshold_operator, metadata
  ) VALUES (
    p_test_run_id, p_metric_name, p_metric_type, p_value, p_unit,
    v_passed, p_expected_value, p_threshold_operator, p_metadata
  );

  RETURN COALESCE(v_passed, TRUE);
END;
$$;

-- Function to complete chaos test run
CREATE OR REPLACE FUNCTION public.complete_chaos_test(
  p_test_run_id UUID,
  p_status TEXT DEFAULT 'completed',
  p_results JSONB DEFAULT '{}',
  p_violations JSONB[] DEFAULT '{}'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_started_at TIMESTAMPTZ;
  v_duration_ms INTEGER;
BEGIN
  -- Only platform admins can complete tests
  IF NOT public.is_tupa_admin() THEN
    RETURN FALSE;
  END IF;

  -- Get start time and calculate duration
  SELECT started_at INTO v_started_at 
  FROM public.chaos_test_runs 
  WHERE id = p_test_run_id;

  IF FOUND THEN
    v_duration_ms := EXTRACT(epoch FROM (now() - v_started_at)) * 1000;
    
    -- Update test run
    UPDATE public.chaos_test_runs 
    SET status = p_status,
        finished_at = now(),
        duration_ms = v_duration_ms,
        results = p_results,
        violations = p_violations,
        updated_at = now()
    WHERE id = p_test_run_id;

    -- Log completion
    INSERT INTO public.pos_logs (level, scope, message, meta)
    VALUES (
      CASE WHEN p_status = 'completed' THEN 'info' ELSE 'error' END,
      'chaos_testing',
      format('Chaos test %s: %s', p_status, p_test_run_id),
      jsonb_build_object(
        'test_run_id', p_test_run_id,
        'duration_ms', v_duration_ms,
        'violations_count', array_length(p_violations, 1),
        'results', p_results
      )
    );

    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Add timestamps triggers
CREATE TRIGGER update_chaos_test_runs_timestamp
  BEFORE UPDATE ON public.chaos_test_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_chaos_scenarios_timestamp  
  BEFORE UPDATE ON public.chaos_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Comments
COMMENT ON TABLE public.chaos_test_runs IS 'Tracks chaos engineering test executions for POS rotation system';
COMMENT ON TABLE public.chaos_scenarios IS 'Defines chaos test scenarios and their configurations';
COMMENT ON TABLE public.chaos_test_metrics IS 'Records metrics and assertions during chaos tests';