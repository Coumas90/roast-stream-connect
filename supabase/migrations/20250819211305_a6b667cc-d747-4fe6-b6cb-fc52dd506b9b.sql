-- Phase 1: Update get_fudo_credentials_expiring with limit and cooldown
-- Replace existing function with enhanced version

CREATE OR REPLACE FUNCTION public.get_fudo_credentials_expiring(_days_ahead integer DEFAULT 3, _limit integer DEFAULT 50)
 RETURNS TABLE(location_id uuid, secret_ref text, expires_at timestamp with time zone, days_until_expiry integer, last_rotation_attempt_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    pc.location_id,
    pc.secret_ref,
    pc.expires_at,
    EXTRACT(days FROM (pc.expires_at - now()))::integer AS days_until_expiry,
    pc.last_rotation_attempt_at
  FROM public.pos_credentials pc
  WHERE pc.provider = 'fudo'
    AND pc.expires_at IS NOT NULL
    AND pc.expires_at <= (now() + make_interval(days => _days_ahead))
    AND pc.rotation_status IN ('active','failed')
    -- 4-hour cooldown filter: only include if never attempted OR last attempt > 4 hours ago
    AND (pc.last_rotation_attempt_at IS NULL OR pc.last_rotation_attempt_at < (now() - interval '4 hours'))
  ORDER BY 
    pc.expires_at ASC,                           -- Most urgent first
    pc.last_rotation_attempt_at ASC NULLS FIRST  -- Never attempted have priority
  LIMIT _limit;
$function$;

-- Phase 2: Create function to mark rotation attempt timestamp
CREATE OR REPLACE FUNCTION public.mark_rotation_attempt(_location_id uuid, _provider app_pos_provider)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow platform admins or internal services to mark attempts
  IF NOT (is_tupa_admin() OR auth.uid() IS NULL) THEN
    RETURN FALSE;
  END IF;
  
  -- Update last_rotation_attempt_at timestamp BEFORE processing
  -- Use WHERE clause to avoid race conditions
  UPDATE public.pos_credentials 
  SET last_rotation_attempt_at = now(),
      updated_at = now()
  WHERE location_id = _location_id 
    AND provider = _provider 
    AND rotation_status IN ('active', 'failed')
    AND (last_rotation_attempt_at IS NULL OR last_rotation_attempt_at < (now() - interval '3 hours 50 minutes'));
  
  RETURN FOUND;
END;
$function$;