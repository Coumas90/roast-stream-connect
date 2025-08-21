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
$function$;