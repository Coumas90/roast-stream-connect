-- Fix the final SECURITY DEFINER view-like function
CREATE OR REPLACE FUNCTION public.check_consecutive_rotation_failures()
RETURNS TABLE(location_id uuid, provider app_pos_provider, consecutive_failures integer, last_rotation_id uuid, last_error text)
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_threshold INTEGER := 3; -- Alert at 3 consecutive failures
BEGIN
  -- Only platform admins can monitor rotation failures
  IF NOT public.is_tupa_admin() THEN
    RAISE EXCEPTION 'Only platform administrators can monitor rotation failures';
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
$function$;

-- Log the final security fix
INSERT INTO public.pos_logs (level, scope, message, meta)
VALUES (
  'info',
  'security_fix',
  'Fixed final SECURITY DEFINER view-like function: check_consecutive_rotation_failures',
  jsonb_build_object(
    'fixed_function', 'check_consecutive_rotation_failures',
    'timestamp', now(),
    'security_issue', 'security_definer_view_final_final'
  )
);