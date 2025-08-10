-- Fix ambiguous "id" by aliasing target table and qualifying functions

-- create_location_invitation: alias target table to reference inv.id explicitly and qualify gen_random_uuid
CREATE OR REPLACE FUNCTION public.create_location_invitation(
  _email text,
  _role app_role,
  _location_id uuid,
  _expires_in_minutes integer DEFAULT 10080
)
RETURNS TABLE(
  id uuid,
  token text,
  email text,
  role app_role,
  tenant_id uuid,
  location_id uuid,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
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

  IF NOT (v_is_owner OR v_is_manager) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;

  v_allowed := CASE
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

  PERFORM public.log_invitation_event('created', v_id, lower(_email), v_tenant, jsonb_build_object('role', _role, 'location_id', _location_id));

  RETURN QUERY
  SELECT v_id, v_token, lower(_email), _role, v_tenant, _location_id, v_expires_at;
END;
$function$;

-- rotate_invitation_token: alias target table for clarity when referencing id
CREATE OR REPLACE FUNCTION public.rotate_invitation_token(
  _invitation_id uuid,
  _expires_in_minutes integer DEFAULT 10080
)
RETURNS TABLE(id uuid, token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inv public.invitations%rowtype;
  v_inviter uuid;
  v_token text;
  v_hash text;
  v_expires_at timestamptz;
BEGIN
  v_inviter := auth.uid();
  IF v_inviter IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT * INTO v_inv FROM public.invitations WHERE id = _invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found';
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'already accepted';
  END IF;

  IF NOT public.user_has_location(v_inv.location_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_inviter
      AND ur.role IN ('owner'::public.app_role, 'manager'::public.app_role)
      AND (ur.location_id = v_inv.location_id OR ur.tenant_id = v_inv.tenant_id)
  ) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + make_interval(mins => _expires_in_minutes);

  UPDATE public.invitations AS inv
  SET token_hash = v_hash,
      expires_at = v_expires_at,
      updated_at = now()
  WHERE inv.id = _invitation_id;

  PERFORM public.log_invitation_event('resent', _invitation_id, v_inv.email, v_inv.tenant_id, jsonb_build_object('role', v_inv.role, 'location_id', v_inv.location_id));

  RETURN QUERY SELECT _invitation_id, v_token, v_expires_at;
END;
$function$;

-- revoke_invitation: alias target table for clarity
CREATE OR REPLACE FUNCTION public.revoke_invitation(_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inv public.invitations%rowtype;
  v_inviter uuid;
  v_scramble text;
BEGIN
  v_inviter := auth.uid();
  IF v_inviter IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT * INTO v_inv FROM public.invitations WHERE id = _invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found';
  END IF;

  IF NOT public.user_has_location(v_inv.location_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_inviter
      AND ur.role IN ('owner'::public.app_role, 'manager'::public.app_role)
      AND (ur.location_id = v_inv.location_id OR ur.tenant_id = v_inv.tenant_id)
  ) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;

  v_scramble := encode(extensions.gen_random_bytes(16), 'hex');

  UPDATE public.invitations AS inv
  SET token_hash = encode(extensions.digest(v_scramble, 'sha256'), 'hex'),
      updated_at = now(),
      expires_at = now() - interval '1 minute'
  WHERE inv.id = _invitation_id;

  PERFORM public.log_invitation_event('revoked', _invitation_id, v_inv.email, v_inv.tenant_id, jsonb_build_object('role', v_inv.role, 'location_id', v_inv.location_id));
END;
$function$;