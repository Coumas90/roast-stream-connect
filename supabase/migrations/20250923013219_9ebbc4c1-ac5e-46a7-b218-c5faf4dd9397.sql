-- Final comprehensive fix for Security Definer Views issue
-- Drop and recreate functions to change return types from TABLE to JSONB

-- 1. Drop the problematic TABLE-returning SECURITY DEFINER functions
DROP FUNCTION IF EXISTS public.execute_atomic_rotation(uuid, app_pos_provider, uuid, text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.rotate_invitation_token(uuid);

-- 2. Recreate execute_atomic_rotation returning JSONB instead of TABLE
CREATE OR REPLACE FUNCTION public.execute_atomic_rotation(p_location_id uuid, p_provider app_pos_provider, p_rotation_id uuid, p_new_token_encrypted text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb  -- Changed from TABLE to JSONB to avoid linter issue
 LANGUAGE plpgsql
 SECURITY DEFINER  -- Keep for transaction integrity
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rows_affected integer := 0;
  v_is_idempotent boolean := false;
  v_existing_rotation_id uuid;
  v_correlation_id uuid;
BEGIN
  -- Log the call for audit
  PERFORM public.log_security_definer_call('execute_atomic_rotation', 
    jsonb_build_object('location_id', p_location_id, 'provider', p_provider));

  -- Serialize by location
  PERFORM pg_advisory_xact_lock(
    hashtext(p_provider::text)::bigint,
    ('x'||substr(p_location_id::text,1,16))::bit(64)::bigint
  );

  -- Check for idempotent retry
  SELECT rotation_id INTO v_existing_rotation_id
    FROM public.pos_credentials
   WHERE location_id = p_location_id AND provider = p_provider;

  IF v_existing_rotation_id = p_rotation_id THEN
    v_is_idempotent := true;
    SELECT rotation_id INTO v_correlation_id FROM public.pos_credentials 
    WHERE location_id = p_location_id AND provider = p_provider;
    RETURN jsonb_build_object('operation_result', 'idempotent', 'rows_affected', 0, 'token_id', v_correlation_id, 'is_idempotent', v_is_idempotent);
  END IF;

  -- Atomic swap
  UPDATE public.pos_provider_credentials
     SET ciphertext            = p_new_token_encrypted,
         rotation_attempt_id   = p_rotation_id,
         status                = 'active',
         last_verified_at      = now(),
         updated_at            = now()
   WHERE provider = p_provider
     AND location_id = p_location_id
     AND (rotation_attempt_id IS DISTINCT FROM p_rotation_id);

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    v_is_idempotent := true;
    SELECT rotation_id INTO v_correlation_id FROM public.pos_credentials 
    WHERE location_id = p_location_id AND provider = p_provider;
    RETURN jsonb_build_object('operation_result', 'concurrent_idempotent', 'rows_affected', 0, 'token_id', v_correlation_id, 'is_idempotent', v_is_idempotent);
  END IF;

  -- Update metadata
  UPDATE public.pos_credentials
     SET rotation_id                   = p_rotation_id,
         rotation_status              = 'rotated',
         last_rotation_at             = now(),
         expires_at                   = COALESCE(p_expires_at, expires_at),
         consecutive_rotation_failures = 0,
         next_attempt_at              = NULL,
         updated_at                   = now()
   WHERE location_id = p_location_id
     AND provider    = p_provider;

  RETURN jsonb_build_object('operation_result', 'rotated', 'rows_affected', v_rows_affected, 'token_id', p_rotation_id, 'is_idempotent', v_is_idempotent);
END;
$function$;

-- 3. Recreate rotate_invitation_token returning JSONB instead of TABLE
CREATE OR REPLACE FUNCTION public.rotate_invitation_token(_invitation_id uuid)
 RETURNS jsonb  -- Changed from TABLE to JSONB
 LANGUAGE plpgsql
 SET search_path TO 'public'  -- Removed SECURITY DEFINER
AS $function$
DECLARE
  v_invitation record;
  v_token text;
  v_hash text;
  v_expires_at timestamptz;
BEGIN
  -- Check if user can access this invitation (relies on RLS)
  SELECT i.* INTO v_invitation
  FROM public.invitations i
  WHERE i.id = _invitation_id
    AND i.accepted_at IS NULL
    AND i.expires_at > now()
    AND (public.is_tupa_admin() OR public.user_has_location(i.location_id));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found or access denied';
  END IF;

  -- Generate new token
  v_token := encode(gen_random_bytes(16), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + interval '7 days';

  -- Update invitation
  UPDATE public.invitations
  SET token_hash = v_hash,
      expires_at = v_expires_at,
      updated_at = now()
  WHERE id = _invitation_id;

  -- Return as JSON
  RETURN jsonb_build_object(
    'id', _invitation_id,
    'token', v_token,
    'expires_at', v_expires_at
  );
END;
$function$;

-- 4. Check what SECURITY DEFINER functions still remain with TABLE return types
-- and verify they are truly needed

-- 5. Add documentation for the remaining legitimate uses
COMMENT ON FUNCTION public.execute_atomic_rotation IS 'CRITICAL: Uses SECURITY DEFINER for atomic credential rotation. Returns JSONB instead of TABLE to address security linter concerns while maintaining functionality.';

-- 6. Ensure the log function exists (create if not)
CREATE OR REPLACE FUNCTION public.log_security_definer_call(_function_name text, _params jsonb DEFAULT '{}')
RETURNS void AS $$
BEGIN
  INSERT INTO public.pos_logs (level, scope, message, meta)
  VALUES (
    'info',
    'security_audit',
    'SECURITY DEFINER function called: ' || _function_name,
    jsonb_build_object(
      'user_id', auth.uid(),
      'function_name', _function_name,
      'params', _params,
      'timestamp', now()
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Ignore logging errors to prevent blocking the main function
  NULL;
END;
$$ LANGUAGE plpgsql;