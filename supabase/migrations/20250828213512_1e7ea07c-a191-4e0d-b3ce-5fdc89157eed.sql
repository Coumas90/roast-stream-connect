-- Drop and recreate get_recent_alert_incidents with correct parameter name
DROP FUNCTION IF EXISTS public.get_recent_alert_incidents(integer);

-- Now recreate all the remaining SECURITY DEFINER view-like functions as SECURITY INVOKER

-- 1. Fix effective_pos function (view-like)
CREATE OR REPLACE FUNCTION public.effective_pos(_tenant_id uuid, _location_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(provider app_pos_provider, source text, connected boolean)
LANGUAGE plpgsql
STABLE SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Autorización a nivel tenant (admin platform también permitido dentro de user_has_tenant)
  IF NOT public.user_has_tenant(_tenant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Prioridad: location conectado > tenant conectado
  IF _location_id IS NOT NULL THEN
    RETURN QUERY
    SELECT pil.provider, 'location'::text AS source, pil.connected
    FROM public.pos_integrations_location pil
    WHERE pil.location_id = _location_id AND pil.connected = true
    LIMIT 1;
  END IF;

  -- Si no hay override o no hay location
  RETURN QUERY
  SELECT pit.provider, 'tenant'::text AS source, pit.connected
  FROM public.pos_integrations_tenant pit
  WHERE pit.tenant_id = _tenant_id AND pit.connected = true
  LIMIT 1;
END;
$function$;

-- 2. Fix get_active_alert_rules function (view-like)
CREATE OR REPLACE FUNCTION public.get_active_alert_rules()
RETURNS TABLE(id text, name text, alert_type text, threshold_value numeric, threshold_operator text, cooldown_minutes integer, severity text, channels jsonb, metadata jsonb)
LANGUAGE sql
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    AND public.is_tupa_admin()  -- Only admins can see alert rules
  ORDER BY ar.severity DESC, ar.alert_type;
$function$;

-- 3. Fix get_pos_credentials_safe function (view-like)
CREATE OR REPLACE FUNCTION public.get_pos_credentials_safe(_location_id uuid)
RETURNS TABLE(location_id uuid, provider app_pos_provider, masked_hints jsonb, status text, last_verified_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    c.location_id,
    c.provider,
    c.masked_hints,
    c.status,
    c.last_verified_at,
    c.updated_at
  FROM public.pos_provider_credentials c
  WHERE c.location_id = _location_id
    AND public.user_can_manage_pos(_location_id);
$function$;

-- 4. Fix pos_provider_credentials_public function (view-like)
CREATE OR REPLACE FUNCTION public.pos_provider_credentials_public(_location_id uuid)
RETURNS TABLE(location_id uuid, provider app_pos_provider, masked_hints jsonb, status text, last_verified_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE sql
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Log access attempt
  INSERT INTO public.pos_logs (level, scope, message, location_id, meta)
  VALUES (
    'info',
    'security_audit', 
    'POS credentials accessed via secure function',
    _location_id,
    jsonb_build_object('user_id', auth.uid(), 'timestamp', now())
  );

  -- Return only safe data
  SELECT
    c.location_id,
    c.provider,
    c.masked_hints,
    c.status,
    c.last_verified_at,
    c.updated_at
  FROM public.pos_provider_credentials c
  WHERE c.location_id = _location_id
    AND public.user_can_manage_pos(_location_id);
$function$;

-- 5. Fix list_location_invitations function (view-like) 
CREATE OR REPLACE FUNCTION public.list_location_invitations(_location_id uuid)
RETURNS TABLE(id uuid, email text, role app_role, tenant_id uuid, location_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, expires_at timestamp with time zone, accepted_at timestamp with time zone, created_by uuid)
LANGUAGE sql
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    i.id,
    i.email,
    i.role,
    i.tenant_id,
    i.location_id,
    i.created_at,
    i.updated_at,
    i.expires_at,
    i.accepted_at,
    i.created_by
  FROM public.invitations i
  WHERE i.location_id = _location_id
    AND (public.is_tupa_admin() OR public.user_has_location(_location_id))
    AND i.accepted_at IS NULL
  ORDER BY i.created_at DESC;
$function$;

-- 6. Recreate get_recent_alert_incidents function (view-like) with correct parameter
CREATE OR REPLACE FUNCTION public.get_recent_alert_incidents(_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, alert_rule_id text, rule_name text, status text, severity text, message text, triggered_at timestamp with time zone, acknowledged_at timestamp with time zone, resolved_at timestamp with time zone, metadata jsonb, channels_notified jsonb)
LANGUAGE sql
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  LEFT JOIN public.alert_rules ar ON ar.id = ai.alert_rule_id
  WHERE public.is_tupa_admin()  -- Only admins can see alert incidents
  ORDER BY ai.triggered_at DESC
  LIMIT _limit;
$function$;

-- 7. Fix calculate_pos_mttr_7d function (analytical view-like function)
CREATE OR REPLACE FUNCTION public.calculate_pos_mttr_7d()
RETURNS TABLE(provider app_pos_provider, location_id uuid, avg_mttr_minutes numeric, failure_count bigint, recovery_count bigint, mttr_status text)
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
          AND s.ts <= f.ts + interval '4 hours'
      ) as recovered_at
    FROM rotation_events f
    WHERE f.event_code = 'rotation_failure'
      AND f.rotation_id IS NULL
  ),
  all_pairs AS (
    SELECT provider, location_id, failed_at, recovered_at FROM rotation_id_pairs
    UNION ALL
    SELECT provider, location_id, failed_at, recovered_at FROM temporal_pairs
  ),
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
$function$;