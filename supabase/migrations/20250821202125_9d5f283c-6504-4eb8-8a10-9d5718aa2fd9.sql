-- PR2: Configurable thresholds via pos_settings
-- Enable adjustment of dashboard semaphores without deployments

-- 1) Create pos_settings table for configurable thresholds
CREATE TABLE IF NOT EXISTS public.pos_settings (
  key text PRIMARY KEY,
  value numeric NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- 2) Insert default threshold values
INSERT INTO public.pos_settings(key, value, description) VALUES
  ('mttr_green_max_minutes', 30, 'MTTR threshold for green status (minutes)'),
  ('mttr_amber_max_minutes', 60, 'MTTR threshold for amber status (minutes)'),
  ('expiry_warn_hours', 72, 'Hours before expiry to show warning'),
  ('expiry_crit_hours', 24, 'Hours before expiry to show critical'),
  ('health_score_mttr_penalty', 1, 'Penalty per minute of MTTR over amber threshold'),
  ('health_score_critical_penalty', 20, 'Penalty per critical expiration'),
  ('health_score_warning_penalty', 5, 'Penalty per warning expiration'),
  ('health_score_breaker_penalty', 30, 'Penalty per open circuit breaker')
ON CONFLICT (key) DO NOTHING;

-- 3) Apply RLS to pos_settings (admin only)
ALTER TABLE public.pos_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_settings_admin_only" ON public.pos_settings
FOR ALL
USING (public.is_tupa_admin())
WITH CHECK (public.is_tupa_admin());

-- 4) Create function to get settings as JSON
CREATE OR REPLACE FUNCTION public.get_pos_settings()
RETURNS jsonb
LANGUAGE sql 
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_object_agg(key, to_jsonb(value)) 
  FROM public.pos_settings;
$$;

-- 5) Create function to update settings (admin only)
CREATE OR REPLACE FUNCTION public.update_pos_setting(_key text, _value numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only platform admins can update settings
  IF NOT public.is_tupa_admin() THEN
    RAISE EXCEPTION 'Only platform administrators can update settings';
  END IF;

  UPDATE public.pos_settings 
  SET value = _value, 
      updated_at = now(),
      updated_by = auth.uid()
  WHERE key = _key;

  RETURN FOUND;
END;
$$;

-- 6) Update dashboard summary to use configurable thresholds
CREATE OR REPLACE FUNCTION public.get_pos_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
  v_settings jsonb;
  v_expirations_critical integer;
  v_expirations_warning integer;
  v_breakers_open integer;
  v_avg_mttr numeric;
  v_health_score integer;
  v_mttr_green_max numeric;
  v_mttr_amber_max numeric;
  v_expiry_crit_hours numeric;
  v_expiry_warn_hours numeric;
BEGIN
  -- Only platform admins can access dashboard summary
  IF NOT public.is_tupa_admin() THEN
    RAISE EXCEPTION 'Only platform administrators can access dashboard summary';
  END IF;

  -- Get configurable settings
  SELECT public.get_pos_settings() INTO v_settings;
  
  v_mttr_green_max := (v_settings->>'mttr_green_max_minutes')::numeric;
  v_mttr_amber_max := (v_settings->>'mttr_amber_max_minutes')::numeric;
  v_expiry_crit_hours := (v_settings->>'expiry_crit_hours')::numeric;
  v_expiry_warn_hours := (v_settings->>'expiry_warn_hours')::numeric;

  -- Count critical expirations using configurable threshold
  SELECT COUNT(*) INTO v_expirations_critical
  FROM public.pos_dashboard_expirations
  WHERE hours_until_expiry < v_expiry_crit_hours;

  -- Count warning expirations using configurable threshold
  SELECT COUNT(*) INTO v_expirations_warning
  FROM public.pos_dashboard_expirations
  WHERE hours_until_expiry < v_expiry_warn_hours 
    AND hours_until_expiry >= v_expiry_crit_hours;

  -- Count open circuit breakers
  SELECT COUNT(*) INTO v_breakers_open
  FROM public.rotation_cb
  WHERE state = 'open';

  -- Calculate average MTTR using enhanced function
  SELECT AVG(avg_mttr_minutes) INTO v_avg_mttr
  FROM public.calculate_pos_mttr_7d_enhanced()
  WHERE avg_mttr_minutes > 0;

  -- Calculate health score using configurable penalties
  v_health_score := GREATEST(0, 100 - 
    (v_expirations_critical * (v_settings->>'health_score_critical_penalty')::integer) - 
    (v_expirations_warning * (v_settings->>'health_score_warning_penalty')::integer) - 
    (v_breakers_open * (v_settings->>'health_score_breaker_penalty')::integer) - 
    (CASE 
      WHEN v_avg_mttr > v_mttr_amber_max 
      THEN ((v_avg_mttr - v_mttr_amber_max) * (v_settings->>'health_score_mttr_penalty')::numeric)::integer
      ELSE 0 
    END)
  );

  v_result := jsonb_build_object(
    'summary', jsonb_build_object(
      'health_score', v_health_score,
      'health_status', CASE 
        WHEN v_health_score >= 90 THEN 'green'
        WHEN v_health_score >= 70 THEN 'amber'
        ELSE 'red'
      END,
      'expirations_critical', v_expirations_critical,
      'expirations_warning', v_expirations_warning,
      'breakers_open', v_breakers_open,
      'avg_mttr_minutes', COALESCE(v_avg_mttr, 0),
      'mttr_status', CASE 
        WHEN v_avg_mttr IS NULL THEN 'no_data'
        WHEN v_avg_mttr <= v_mttr_green_max THEN 'green'
        WHEN v_avg_mttr <= v_mttr_amber_max THEN 'amber'
        ELSE 'red'
      END
    ),
    'settings', v_settings,
    'timestamp', now()
  );

  RETURN v_result;
END;
$$;

-- 7) Update enhanced MTTR function to use configurable thresholds
CREATE OR REPLACE FUNCTION public.calculate_pos_mttr_7d_enhanced()
RETURNS TABLE(
  provider app_pos_provider, 
  location_id uuid, 
  avg_mttr_minutes numeric, 
  failure_count bigint, 
  recovery_count bigint, 
  mttr_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settings jsonb;
  v_mttr_green_max numeric;
  v_mttr_amber_max numeric;
BEGIN
  -- Only platform admins can access MTTR analytics
  IF NOT public.is_tupa_admin() THEN
    RAISE EXCEPTION 'Only platform administrators can access MTTR analytics';
  END IF;

  -- Get configurable thresholds
  SELECT public.get_pos_settings() INTO v_settings;
  v_mttr_green_max := (v_settings->>'mttr_green_max_minutes')::numeric;
  v_mttr_amber_max := (v_settings->>'mttr_amber_max_minutes')::numeric;

  RETURN QUERY
  WITH rotation_events AS (
    -- Get typed rotation events from last 7 days
    SELECT 
      pl.provider,
      pl.location_id,
      pl.ts,
      pl.event_code,
      COALESCE(pl.meta->>'rotation_id', pl.meta->>'runId') as rotation_id
    FROM public.pos_logs pl
    WHERE pl.ts >= (now() - interval '7 days')
      AND pl.scope = 'rotation'
      AND pl.provider IS NOT NULL
      AND pl.location_id IS NOT NULL
      AND pl.event_code IN ('rotation_failure', 'rotation_success')
  ),
  -- Method 1: Match by rotation_id when available
  rotation_id_pairs AS (
    SELECT 
      f.provider,
      f.location_id,
      f.ts as failed_at,
      MIN(s.ts) as recovered_at
    FROM rotation_events f
    JOIN rotation_events s ON (
      s.provider = f.provider 
      AND s.location_id = f.location_id 
      AND s.rotation_id = f.rotation_id
      AND s.event_code = 'rotation_success'
      AND s.ts > f.ts
    )
    WHERE f.event_code = 'rotation_failure'
      AND f.rotation_id IS NOT NULL
      AND s.rotation_id IS NOT NULL
    GROUP BY f.provider, f.location_id, f.ts
  ),
  -- Method 2: Temporal fallback for events without rotation_id
  temporal_pairs AS (
    SELECT 
      f.provider,
      f.location_id,
      f.ts as failed_at,
      (
        SELECT MIN(s.ts) 
        FROM rotation_events s 
        WHERE s.provider = f.provider 
          AND s.location_id = f.location_id 
          AND s.event_code = 'rotation_success' 
          AND s.ts > f.ts
          AND s.ts <= f.ts + interval '4 hours' -- reasonable recovery window
      ) as recovered_at
    FROM rotation_events f
    WHERE f.event_code = 'rotation_failure'
      AND f.rotation_id IS NULL
  ),
  -- Combine both methods
  all_pairs AS (
    SELECT provider, location_id, failed_at, recovered_at FROM rotation_id_pairs
    UNION ALL
    SELECT provider, location_id, failed_at, recovered_at FROM temporal_pairs
  ),
  -- Calculate MTTR statistics
  mttr_calc AS (
    SELECT 
      ap.provider,
      ap.location_id,
      COUNT(*) as failure_count,
      COUNT(ap.recovered_at) as recovery_count,
      AVG(EXTRACT(epoch FROM (ap.recovered_at - ap.failed_at)) / 60)::numeric as avg_mttr_minutes
    FROM all_pairs ap
    WHERE ap.recovered_at IS NOT NULL
    GROUP BY ap.provider, ap.location_id
  )
  SELECT 
    mc.provider,
    mc.location_id,
    COALESCE(mc.avg_mttr_minutes, 0) as avg_mttr_minutes,
    mc.failure_count,
    mc.recovery_count,
    CASE 
      WHEN mc.avg_mttr_minutes IS NULL THEN 'no_data'
      WHEN mc.avg_mttr_minutes <= v_mttr_green_max THEN 'green'
      WHEN mc.avg_mttr_minutes <= v_mttr_amber_max THEN 'amber'
      ELSE 'red'
    END as mttr_status
  FROM mttr_calc mc;
END;
$$;

-- 8) Add trigger to update timestamp on settings changes
CREATE OR REPLACE FUNCTION public.update_pos_settings_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER pos_settings_update_timestamp
  BEFORE UPDATE ON public.pos_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pos_settings_timestamp();