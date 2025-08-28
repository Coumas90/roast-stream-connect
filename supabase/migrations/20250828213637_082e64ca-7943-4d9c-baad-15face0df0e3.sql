-- Fix the remaining get_fudo_credentials_expiring SECURITY DEFINER function
-- Convert the single-parameter version to SECURITY INVOKER

CREATE OR REPLACE FUNCTION public.get_fudo_credentials_expiring(_days_ahead integer DEFAULT 3)
RETURNS TABLE(location_id uuid, secret_ref text, expires_at timestamp with time zone, days_until_expiry integer)
LANGUAGE sql
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    pc.location_id,
    pc.secret_ref,
    pc.expires_at,
    EXTRACT(days FROM (pc.expires_at - now()))::integer AS days_until_expiry
  FROM public.pos_credentials pc
  WHERE pc.provider = 'fudo'
    AND pc.expires_at IS NOT NULL
    AND pc.expires_at <= (now() + make_interval(days => _days_ahead))
    AND pc.rotation_status IN ('active','failed')
    AND (public.is_tupa_admin() OR public.user_has_location(pc.location_id))  -- Add proper access control
  ORDER BY 
    pc.expires_at ASC,
    pc.last_rotation_attempt_at ASC NULLS FIRST
  LIMIT 50;
$function$;

-- Also fix the two-parameter version to SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.get_fudo_credentials_expiring(_days_ahead integer DEFAULT 3, _limit integer DEFAULT 50)
RETURNS TABLE(location_id uuid, secret_ref text, expires_at timestamp with time zone, days_until_expiry integer, last_rotation_attempt_at timestamp with time zone)
LANGUAGE sql
SECURITY INVOKER  -- Changed from SECURITY DEFINER
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
    -- Add proper access control - only admin or users with location access
    AND (public.is_tupa_admin() OR public.user_has_location(pc.location_id))
    -- 4-hour cooldown filter: only include if never attempted OR last attempt > 4 hours ago
    AND (pc.last_rotation_attempt_at IS NULL OR pc.last_rotation_attempt_at < (now() - interval '4 hours'))
  ORDER BY 
    pc.expires_at ASC,                           -- Most urgent first
    pc.last_rotation_attempt_at ASC NULLS FIRST  -- Never attempted have priority
  LIMIT _limit;
$function$;

-- Log the final security fix
INSERT INTO public.pos_logs (level, scope, message, meta)
VALUES (
  'info',
  'security_fix',
  'Fixed final SECURITY DEFINER functions',
  jsonb_build_object(
    'fixed_functions', ARRAY[
      'get_fudo_credentials_expiring (single param)',
      'get_fudo_credentials_expiring (two params)'
    ],
    'timestamp', now(),
    'security_issue', 'security_definer_view_final'
  )
);