-- Fix materialized view security issue by replacing with regular view

-- Drop the materialized view
DROP MATERIALIZED VIEW IF EXISTS public.pos_dashboard_expirations;

-- Create regular view with RLS
CREATE VIEW public.pos_dashboard_expirations AS
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
  AND is_tupa_admin() -- Apply RLS at view level
ORDER BY pc.expires_at ASC;

-- Update the dashboard summary function to use regular view
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

  -- Count critical expirations (< 24 hours) - now using regular view
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