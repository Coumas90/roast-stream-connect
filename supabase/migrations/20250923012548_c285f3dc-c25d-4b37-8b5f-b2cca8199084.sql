-- Fix remaining SECURITY DEFINER functions that return TABLE types
-- These functions need SECURITY DEFINER for valid security reasons, so we'll convert them to regular functions with proper RLS

-- 1. Fix create_location_invitation function
-- This function needs to create invitations but can be done without SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.create_location_invitation(_email text, _role app_role, _location_id uuid, _expires_in_minutes integer DEFAULT 10080)
 RETURNS TABLE(id uuid, token text, email text, role app_role, tenant_id uuid, location_id uuid, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE
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

  v_token := encode(gen_random_bytes(16), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + make_interval(mins => _expires_in_minutes);

  DELETE FROM public.invitations i
  WHERE i.tenant_id = v_tenant
    AND i.location_id = _location_id
    AND lower(i.email) = lower(_email)
    AND i.accepted_at IS NULL;

  INSERT INTO public.invitations AS inv (id, token_hash, tenant_id, location_id, email, role, expires_at, created_by)
  VALUES (gen_random_uuid(), v_hash, v_tenant, _location_id, lower(_email), _role, v_expires_at, v_inviter)
  RETURNING inv.id INTO v_id;

  -- Log invitation event (function will handle permission check internally)
  PERFORM public.log_invitation_event('sent', v_id, lower(_email), v_tenant, jsonb_build_object('role', _role, 'location_id', _location_id));

  RETURN QUERY
  SELECT v_id, v_token, lower(_email), _role, v_tenant, _location_id, v_expires_at;
END;
$function$;

-- 2. Keep execute_atomic_rotation as SECURITY DEFINER since it needs elevated privileges for credential rotation
-- This is a legitimate use case for SECURITY DEFINER as it handles sensitive credential operations

-- 3. Keep lease_fudo_rotation_candidates as SECURITY DEFINER since it needs to update rotation timestamps
-- This is also a legitimate use case for background job operations

-- 4. The rotate_invitation_token function doesn't exist in our current schema, so skip it

-- 5. The claim_job_lock function doesn't exist in our current schema, so skip it

-- 6. Update the search path for functions that need it to fix the search path mutable warning
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 7. Fix the sync_profile_email function search path
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER 
LANGUAGE plpgsql 
STABLE
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  -- Update profile email when auth.users email changes
  UPDATE public.profiles 
  SET email = NEW.email
  WHERE id = NEW.id;
  
  -- If no profile exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id, 
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
    )
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  END IF;
  
  RETURN NEW;
END;
$$;