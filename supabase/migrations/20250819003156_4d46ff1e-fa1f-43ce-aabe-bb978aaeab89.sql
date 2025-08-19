-- Fix pos_provider_credentials_public function to allow INSERT operations
-- Change from STABLE to VOLATILE to permit logging inserts

CREATE OR REPLACE FUNCTION public.pos_provider_credentials_public(_location_id uuid)
 RETURNS TABLE(location_id uuid, provider app_pos_provider, masked_hints jsonb, status text, last_verified_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 VOLATILE SECURITY DEFINER
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
$function$