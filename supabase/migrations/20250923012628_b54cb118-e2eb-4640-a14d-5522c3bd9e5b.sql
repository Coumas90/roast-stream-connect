-- Fix remaining SECURITY DEFINER functions that act as views
-- Keep SECURITY DEFINER only where absolutely necessary for security operations

-- 1. Fix create_location_invitation - remove SECURITY DEFINER if possible
-- This function needs elevated privileges to create invitations, so we'll optimize it
-- but keep SECURITY DEFINER for token generation
CREATE OR REPLACE FUNCTION public.create_location_invitation(_email text, _role app_role, _location_id uuid, _expires_in_minutes integer DEFAULT 10080)
 RETURNS TABLE(id uuid, token text, email text, role app_role, tenant_id uuid, location_id uuid, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER  -- Keep this as it needs to generate secure tokens
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

  -- Generate secure token (requires SECURITY DEFINER)
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

  PERFORM public.log_invitation_event('sent', v_id, lower(_email), v_tenant, jsonb_build_object('role', _role, 'location_id', _location_id));

  RETURN QUERY
  SELECT v_id, v_token, lower(_email), _role, v_tenant, _location_id, v_expires_at;
END;
$function$;

-- 2. For other administrative functions, add comments explaining why SECURITY DEFINER is needed
COMMENT ON FUNCTION public.execute_atomic_rotation IS 'SECURITY DEFINER required for atomic token rotation operations across secure credential tables';
COMMENT ON FUNCTION public.lease_fudo_rotation_candidates IS 'SECURITY DEFINER required for internal POS credential rotation system';

-- 3. Check if we can create a view-based alternative for some functions
-- Create a secure view for job lock status that doesn't require SECURITY DEFINER
CREATE OR REPLACE VIEW public.job_lock_status AS
SELECT 
  name,
  CASE 
    WHEN lease_until > now() THEN 'locked'
    ELSE 'available'
  END as status,
  CASE
    WHEN lease_until > now() THEN lease_until
    ELSE NULL
  END as locked_until
FROM public.job_locks
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = auth.uid() 
    AND ur.role = 'tupa_admin'::public.app_role
);

-- 4. Add RLS to job_lock_status view
CREATE POLICY "job_lock_status_admin_only" ON public.job_locks
FOR SELECT USING (public.is_tupa_admin());

-- 5. Create safer wrapper functions that validate permissions before calling SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.get_rotation_candidates(_provider app_pos_provider, _limit integer DEFAULT 50)
RETURNS TABLE(location_id uuid, expires_at timestamp with time zone)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  -- This is a safer wrapper that doesn't expose secret_ref
  SELECT 
    pc.location_id,
    pc.expires_at
  FROM public.pos_credentials pc
  WHERE pc.provider = _provider
    AND pc.expires_at IS NOT NULL
    AND pc.rotation_status IN ('active','failed')
    AND (pc.next_attempt_at IS NULL OR pc.next_attempt_at <= now())
    AND (pc.last_rotation_attempt_at IS NULL OR pc.last_rotation_attempt_at <= now() - interval '4 hours')
    AND (public.is_tupa_admin() OR public.user_has_location(pc.location_id))
  ORDER BY pc.expires_at ASC
  LIMIT _limit;
$function$;