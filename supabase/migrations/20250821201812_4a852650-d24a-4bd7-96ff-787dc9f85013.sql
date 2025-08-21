-- PR1: MTTR with typed events + rotation_id correlation
-- Add typed event system for robust MTTR calculation

-- 1) Create enum for typed rotation events
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pos_event_code') THEN
    CREATE TYPE pos_event_code AS ENUM (
      'rotation_started',
      'rotation_failure', 
      'rotation_success'
    );
  END IF;
END $$;

-- 2) Add event_code column to pos_logs
ALTER TABLE public.pos_logs
  ADD COLUMN IF NOT EXISTS event_code pos_event_code;

-- 3) Backfill existing rotation logs with typed events
UPDATE public.pos_logs
SET event_code = 'rotation_success'
WHERE scope = 'rotation' 
  AND level = 'info' 
  AND (message ILIKE '%rotated successfully%' OR message ILIKE '%rotation completed%')
  AND event_code IS NULL;

UPDATE public.pos_logs
SET event_code = 'rotation_failure'
WHERE scope = 'rotation' 
  AND level = 'error'
  AND event_code IS NULL;

-- 4) Create optimized index for MTTR calculations
CREATE INDEX IF NOT EXISTS pos_logs_rotation_event_idx
  ON public.pos_logs(provider, location_id, ts, event_code)
  WHERE scope = 'rotation' 
    AND event_code IN ('rotation_success', 'rotation_failure');

-- 5) Create enhanced MTTR calculation with rotation_id correlation
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
BEGIN
  -- Only platform admins can access MTTR analytics
  IF NOT public.is_tupa_admin() THEN
    RAISE EXCEPTION 'Only platform administrators can access MTTR analytics';
  END IF;

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
      WHEN mc.avg_mttr_minutes <= 30 THEN 'green'
      WHEN mc.avg_mttr_minutes <= 60 THEN 'amber' 
      ELSE 'red'
    END as mttr_status
  FROM mttr_calc mc;
END;
$$;

-- 6) Update main dashboard summary to use enhanced MTTR
CREATE OR REPLACE FUNCTION public.get_pos_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
  v_expirations_critical integer;
  v_expirations_warning integer;
  v_breakers_open integer;
  v_avg_mttr numeric;
  v_health_score integer;
BEGIN
  -- Only platform admins can access dashboard summary
  IF NOT public.is_tupa_admin() THEN
    RAISE EXCEPTION 'Only platform administrators can access dashboard summary';
  END IF;

  -- Count critical expirations (< 24 hours)
  SELECT COUNT(*) INTO v_expirations_critical
  FROM public.pos_dashboard_expirations
  WHERE hours_until_expiry < 24;

  -- Count warning expirations (< 72 hours)
  SELECT COUNT(*) INTO v_expirations_warning
  FROM public.pos_dashboard_expirations
  WHERE hours_until_expiry < 72 AND hours_until_expiry >= 24;

  -- Count open circuit breakers
  SELECT COUNT(*) INTO v_breakers_open
  FROM public.rotation_cb
  WHERE state = 'open';

  -- Calculate average MTTR using enhanced function
  SELECT AVG(avg_mttr_minutes) INTO v_avg_mttr
  FROM public.calculate_pos_mttr_7d_enhanced()
  WHERE avg_mttr_minutes > 0;

  -- Calculate health score (0-100)
  v_health_score := GREATEST(0, 100 - 
    (v_expirations_critical * 20) - 
    (v_expirations_warning * 5) - 
    (v_breakers_open * 30) - 
    (CASE WHEN v_avg_mttr > 60 THEN (v_avg_mttr - 60) ELSE 0 END)::integer
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
        WHEN v_avg_mttr <= 30 THEN 'green'
        WHEN v_avg_mttr <= 60 THEN 'amber'
        ELSE 'red'
      END
    ),
    'timestamp', now()
  );

  RETURN v_result;
END;
$$;