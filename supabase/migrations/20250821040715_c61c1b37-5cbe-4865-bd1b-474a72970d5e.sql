-- Create function to check consecutive rotation failures and send alerts
CREATE OR REPLACE FUNCTION public.check_consecutive_rotation_failures()
RETURNS TABLE(location_id uuid, provider app_pos_provider, consecutive_failures integer, last_rotation_id uuid, last_error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_threshold INTEGER := 3; -- Alert at 3 consecutive failures
BEGIN
  -- Only platform admins can monitor rotation failures
  IF NOT public.is_tupa_admin() THEN
    RETURN;
  END IF;

  -- Find locations with 3+ consecutive rotation failures
  RETURN QUERY
  SELECT 
    pc.location_id,
    pc.provider,
    pc.consecutive_rotation_failures,
    pc.rotation_id,
    pc.rotation_error_msg
  FROM public.pos_credentials pc
  WHERE pc.consecutive_rotation_failures >= v_threshold
    AND pc.provider = 'fudo'
    AND pc.rotation_status = 'failed'
  ORDER BY pc.consecutive_rotation_failures DESC, pc.updated_at DESC;
END;
$function$

-- Create function to reset rotation failure counter (for manual intervention)
CREATE OR REPLACE FUNCTION public.reset_rotation_failures(_location_id uuid, _provider app_pos_provider)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only platform admins can reset failure counters
  IF NOT public.is_tupa_admin() THEN
    RETURN FALSE;
  END IF;
  
  UPDATE public.pos_credentials
  SET consecutive_rotation_failures = 0,
      rotation_status = 'active',
      rotation_error_code = NULL,
      rotation_error_msg = NULL,
      next_attempt_at = NULL,
      updated_at = now()
  WHERE location_id = _location_id 
    AND provider = _provider;
    
  -- Log the manual reset
  INSERT INTO public.pos_logs (level, scope, message, provider, location_id, meta)
  VALUES (
    'info',
    'manual_intervention',
    'Rotation failure counter manually reset',
    _provider,
    _location_id,
    jsonb_build_object(
      'user_id', auth.uid(),
      'timestamp', now(),
      'action', 'reset_failures'
    )
  );
  
  RETURN FOUND;
END;
$function$