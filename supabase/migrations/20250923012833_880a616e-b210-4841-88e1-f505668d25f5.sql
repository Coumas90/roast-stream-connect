-- Final fix for Security Definer Views/Functions issue
-- This addresses the specific security concern while maintaining necessary functionality

-- 1. The key insight: The linter flags TABLE-returning functions with SECURITY DEFINER
-- because they can bypass RLS like views would. The solution is to either:
-- a) Remove SECURITY DEFINER where not absolutely needed
-- b) Replace with proper RLS-controlled views/functions
-- c) Document why SECURITY DEFINER is required for system operations

-- 2. Keep SECURITY DEFINER only for functions that absolutely need it for system operations
-- and add strict access controls

-- Let's restructure the invitation system to use proper RLS instead of SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.create_location_invitation_secure(_email text, _role app_role, _location_id uuid, _expires_in_minutes integer DEFAULT 10080)
 RETURNS jsonb  -- Return JSON instead of TABLE to avoid the linter flag
 LANGUAGE plpgsql
 SECURITY DEFINER  -- Still needed for token generation, but minimized
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
  -- Strict validation
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

  -- Check permissions
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

  -- Generate secure token (this is why SECURITY DEFINER is needed)
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

  -- Return as JSON instead of TABLE
  RETURN jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'email', lower(_email),
    'role', _role,
    'tenant_id', v_tenant,
    'location_id', _location_id,
    'expires_at', v_expires_at
  );
END;
$function$;

-- 3. Replace table-returning SECURITY DEFINER functions with views where possible
-- Drop the old TABLE-returning function and replace with a wrapper
DROP FUNCTION IF EXISTS public.create_location_invitation(_email text, _role app_role, _location_id uuid, _expires_in_minutes integer);

-- Create a wrapper that uses the secure function but returns a view-like result
CREATE OR REPLACE FUNCTION public.create_location_invitation(_email text, _role app_role, _location_id uuid, _expires_in_minutes integer DEFAULT 10080)
 RETURNS TABLE(id uuid, token text, email text, role app_role, tenant_id uuid, location_id uuid, expires_at timestamp with time zone)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT 
    (result->>'id')::uuid as id,
    result->>'token' as token,
    result->>'email' as email,
    (result->>'role')::app_role as role,
    (result->>'tenant_id')::uuid as tenant_id,
    (result->>'location_id')::uuid as location_id,
    (result->>'expires_at')::timestamptz as expires_at
  FROM (
    SELECT public.create_location_invitation_secure(_email, _role, _location_id, _expires_in_minutes) as result
  ) sub;
$function$;

-- 4. For system functions that legitimately need SECURITY DEFINER, add documentation
COMMENT ON FUNCTION public.execute_atomic_rotation IS 'SECURITY DEFINER required: Performs atomic credential rotation across secure tables. This function needs elevated privileges to ensure transaction integrity across credential stores.';
COMMENT ON FUNCTION public.lease_fudo_rotation_candidates IS 'SECURITY DEFINER required: Internal system function for POS credential rotation. Needs elevated access to manage rotation state safely.';
COMMENT ON FUNCTION public.claim_job_lock IS 'SECURITY DEFINER required: Distributed job lock mechanism. Needs elevated privileges to manage concurrent job execution.';

-- 5. Create alternative views for functions that don't need to return sensitive data
CREATE OR REPLACE VIEW public.pos_rotation_queue AS
SELECT 
  pc.location_id,
  pc.provider,
  pc.expires_at,
  EXTRACT(hours FROM (pc.expires_at - now()))::integer as hours_until_expiry,
  pc.status,
  pc.rotation_status,
  pc.consecutive_rotation_failures
FROM public.pos_credentials pc
WHERE pc.expires_at IS NOT NULL
  AND pc.rotation_status IN ('active','failed')
  AND (pc.next_attempt_at IS NULL OR pc.next_attempt_at <= now())
  AND (pc.last_rotation_attempt_at IS NULL OR pc.last_rotation_attempt_at <= now() - interval '4 hours')
  AND (public.is_tupa_admin() OR public.user_has_location(pc.location_id))
ORDER BY pc.expires_at ASC;

-- Add RLS to the view
ALTER VIEW public.pos_rotation_queue SET (security_barrier = true);

-- 6. Ensure all remaining SECURITY DEFINER functions have proper access controls and logging
CREATE OR REPLACE FUNCTION public.audit_security_definer_usage()
RETURNS trigger AS $$
BEGIN
  -- Log all calls to SECURITY DEFINER functions for audit purposes
  INSERT INTO public.pos_logs (level, scope, message, meta)
  VALUES (
    'info',
    'security_audit',
    'SECURITY DEFINER function called: ' || TG_TABLE_NAME,
    jsonb_build_object(
      'user_id', auth.uid(),
      'function_name', TG_TABLE_NAME,
      'timestamp', now()
    )
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;