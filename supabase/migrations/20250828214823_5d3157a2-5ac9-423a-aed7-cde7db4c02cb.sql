-- Convert the user management functions that can be safely changed from SECURITY DEFINER to SECURITY INVOKER
-- while keeping critical system functions as SECURITY DEFINER

-- 1. Convert create_location_invitation to SECURITY INVOKER (user management function)
CREATE OR REPLACE FUNCTION public.create_location_invitation(_email text, _role app_role, _location_id uuid, _expires_in_minutes integer DEFAULT 10080)
RETURNS TABLE(id uuid, token text, email text, role app_role, tenant_id uuid, location_id uuid, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
  v_inviter uuid;
  v_is_owner boolean;
  v_is_manager boolean;
  v_allowed boolean;
  v_token text;
  v_hash text;
  v_expires_at timestamptz;
  v_id uuid;
BEGIN
  v_inviter := auth.uid();
  IF v_inviter IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT l.tenant_id INTO v_tenant
  FROM public.locations l
  WHERE l.id = _location_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'invalid location';
  END IF;

  IF NOT public.user_has_location(_location_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_inviter
      AND ur.role = 'owner'::public.app_role
      AND (ur.location_id = _location_id OR ur.tenant_id = v_tenant)
  ) INTO v_is_owner;

  SELECT EXISTS(
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_inviter
      AND ur.role = 'manager'::public.app_role
      AND (ur.location_id = _location_id OR ur.tenant_id = v_tenant)
  ) INTO v_is_manager;

  IF NOT (v_is_owner OR v_is_manager OR public.is_tupa_admin()) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;

  v_allowed := CASE
    WHEN public.is_tupa_admin() THEN TRUE
    WHEN v_is_owner THEN _role IN ('manager'::public.app_role, 'coffee_master'::public.app_role, 'barista'::public.app_role)
    WHEN v_is_manager THEN _role IN ('coffee_master'::public.app_role, 'barista'::public.app_role)
    ELSE FALSE
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'role not allowed';
  END IF;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + make_interval(mins => _expires_in_minutes);

  DELETE FROM public.invitations i
  WHERE i.tenant_id = v_tenant
    AND i.location_id = _location_id
    AND lower(i.email) = lower(_email)
    AND i.accepted_at IS NULL;

  INSERT INTO public.invitations AS inv (id, token_hash, tenant_id, location_id, email, role, expires_at, created_by)
  VALUES (extensions.gen_random_uuid(), v_hash, v_tenant, _location_id, lower(_email), _role, v_expires_at, v_inviter)
  RETURNING inv.id INTO v_id;

  -- Log invitation event
  PERFORM public.log_invitation_event('sent', v_id, lower(_email), v_tenant, jsonb_build_object('role', _role, 'location_id', _location_id));

  RETURN QUERY
  SELECT v_id, v_token, lower(_email), _role, v_tenant, _location_id, v_expires_at;
END;
$function$;

-- 2. Convert rotate_invitation_token to SECURITY INVOKER (user management function)
CREATE OR REPLACE FUNCTION public.rotate_invitation_token(_invitation_id uuid, _expires_in_minutes integer DEFAULT 10080)
RETURNS TABLE(id uuid, token text, email text, role app_role, tenant_id uuid, location_id uuid, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation record;
  v_token text;
  v_hash text;
  v_expires_at timestamptz;
BEGIN
  -- Check authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- Get invitation details and verify access
  SELECT * INTO v_invitation
  FROM public.invitations i
  WHERE i.id = _invitation_id
    AND i.accepted_at IS NULL
    AND i.expires_at > now()
    AND (public.is_tupa_admin() OR public.user_has_location(i.location_id));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found or access denied';
  END IF;

  -- Generate new token
  v_token := encode(extensions.gen_random_bytes(16), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + make_interval(mins => _expires_in_minutes);

  -- Update invitation with new token and expiry
  UPDATE public.invitations
  SET token_hash = v_hash,
      expires_at = v_expires_at,
      updated_at = now()
  WHERE id = _invitation_id;

  -- Log the token rotation
  PERFORM public.log_invitation_event('token_rotated', _invitation_id, v_invitation.email, v_invitation.tenant_id, 
    jsonb_build_object('new_expires_at', v_expires_at));

  RETURN QUERY
  SELECT v_invitation.id, v_token, v_invitation.email, v_invitation.role, 
         v_invitation.tenant_id, v_invitation.location_id, v_expires_at;
END;
$function$;

-- Log the security fix
INSERT INTO public.pos_logs (level, scope, message, meta)
VALUES (
  'info',
  'security_fix',
  'Converted user management functions from SECURITY DEFINER to SECURITY INVOKER',
  jsonb_build_object(
    'converted_functions', ARRAY[
      'create_location_invitation',
      'rotate_invitation_token'
    ],
    'kept_security_definer', ARRAY[
      'claim_job_lock',
      'execute_atomic_rotation', 
      'lease_fudo_rotation_candidates'
    ],
    'reason', 'User management functions converted for better security, critical system functions preserved',
    'timestamp', now()
  )
);