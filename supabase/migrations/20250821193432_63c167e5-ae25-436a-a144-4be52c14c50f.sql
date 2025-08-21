-- ===============================================
-- Card 13: POS Dashboard + MTTR Analytics
-- ===============================================

-- 1. Materialized view for upcoming expirations (performance-optimized)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.pos_dashboard_expirations AS
SELECT 
  pc.location_id,
  pc.provider,
  pc.expires_at,
  EXTRACT(days FROM (pc.expires_at - now()))::integer AS days_until_expiry,
  EXTRACT(hours FROM (pc.expires_at - now()))::integer AS hours_until_expiry,
  pc.status,
  pc.rotation_status,
  pc.consecutive_rotation_failures,
  pc.last_rotation_at,
  l.name as location_name,
  t.name as tenant_name
FROM public.pos_credentials pc
JOIN public.locations l ON l.id = pc.location_id
JOIN public.tenants t ON t.id = l.tenant_id
WHERE pc.expires_at IS NOT NULL
  AND pc.expires_at > now()
ORDER BY pc.expires_at ASC;

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_pos_dashboard_expirations_days 
ON public.pos_credentials (expires_at) 
WHERE expires_at IS NOT NULL AND expires_at > now();

-- 2. MTTR calculation function (last 7 days)
CREATE OR REPLACE FUNCTION public.calculate_pos_mttr_7d()
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
AS $function$
BEGIN
  -- Only platform admins can access MTTR analytics
  IF NOT public.is_tupa_admin() THEN
    RAISE EXCEPTION 'Only platform administrators can access MTTR analytics';
  END IF;

  RETURN QUERY
  WITH rotation_events AS (
    -- Get failure and recovery events from pos_logs for last 7 days
    SELECT 
      pl.provider,
      pl.location_id,
      pl.ts,
      pl.message,
      CASE 
        WHEN pl.scope = 'rotation' AND pl.level = 'error' THEN 'failure'
        WHEN pl.scope = 'rotation' AND pl.level = 'info' AND pl.message LIKE '%rotated successfully%' THEN 'recovery'
        ELSE 'other'
      END as event_type
    FROM public.pos_logs pl
    WHERE pl.ts >= (now() - interval '7 days')
      AND pl.scope = 'rotation'
      AND pl.provider IS NOT NULL
      AND pl.location_id IS NOT NULL
  ),
  failure_recovery_pairs AS (
    -- Match failures with their next recovery
    SELECT 
      f.provider,
      f.location_id,
      f.ts as failed_at,
      (
        SELECT MIN(r.ts) 
        FROM rotation_events r 
        WHERE r.provider = f.provider 
          AND r.location_id = f.location_id 
          AND r.event_type = 'recovery' 
          AND r.ts > f.ts
      ) as recovered_at
    FROM rotation_events f
    WHERE f.event_type = 'failure'
  ),
  mttr_calc AS (
    SELECT 
      frp.provider,
      frp.location_id,
      COUNT(*) as failure_count,
      COUNT(frp.recovered_at) as recovery_count,
      AVG(EXTRACT(epoch FROM (frp.recovered_at - frp.failed_at)) / 60)::numeric as avg_mttr_minutes
    FROM failure_recovery_pairs frp
    GROUP BY frp.provider, frp.location_id
  )
  SELECT 
    mc.provider,
    mc.location_id,
    COALESCE(mc.avg_mttr_minutes, 0) as avg_mttr_minutes,
    mc.failure_count,
    mc.recovery_count,
    CASE 
      WHEN mc.avg_mttr_minutes IS NULL THEN 'no_data'
      WHEN mc.avg_mttr_minutes <= 60 THEN 'green'
      WHEN mc.avg_mttr_minutes <= 120 THEN 'amber' 
      ELSE 'red'
    END as mttr_status
  FROM mttr_calc mc;
END;
$function$;

-- 3. Circuit breaker status view
CREATE OR REPLACE VIEW public.pos_dashboard_breakers AS
SELECT 
  rcb.provider,
  rcb.location_id,
  rcb.state,
  rcb.failures,
  rcb.resume_at,
  rcb.window_start,
  rcb.updated_at,
  l.name as location_name,
  t.name as tenant_name,
  CASE 
    WHEN rcb.state = 'closed' THEN 'green'
    WHEN rcb.state = 'half-open' THEN 'amber'
    WHEN rcb.state = 'open' THEN 'red'
    ELSE 'unknown'
  END as status_color
FROM public.rotation_cb rcb
LEFT JOIN public.locations l ON l.id = rcb.location_id
LEFT JOIN public.tenants t ON t.id = l.tenant_id
ORDER BY rcb.updated_at DESC;

-- 4. Dashboard summary function
CREATE OR REPLACE FUNCTION public.get_pos_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Refresh materialized view for current data
  REFRESH MATERIALIZED VIEW public.pos_dashboard_expirations;

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

  -- Calculate average MTTR across all locations
  SELECT AVG(avg_mttr_minutes) INTO v_avg_mttr
  FROM public.calculate_pos_mttr_7d()
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
        WHEN v_avg_mttr <= 60 THEN 'green'
        WHEN v_avg_mttr <= 120 THEN 'amber'
        ELSE 'red'
      END
    ),
    'timestamp', now()
  );

  RETURN v_result;
END;
$function$;

-- 5. Permissions and indexes for performance
GRANT SELECT ON public.pos_dashboard_expirations TO authenticated;
GRANT SELECT ON public.pos_dashboard_breakers TO authenticated;

-- Create refresh function for materialized view (called by cron)
CREATE OR REPLACE FUNCTION public.refresh_pos_dashboard_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW public.pos_dashboard_expirations;
END;
$function$;