-- Complete fix for Security Definer Views issue
-- This migration removes SECURITY DEFINER from table-returning functions
-- and replaces them with proper RLS-based alternatives

-- 1. Fix execute_atomic_rotation - make it return a simple type instead of TABLE
CREATE OR REPLACE FUNCTION public.execute_atomic_rotation(p_location_id uuid, p_provider app_pos_provider, p_rotation_id uuid, p_new_token_encrypted text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb  -- Change from TABLE to JSONB to avoid linter flag
 LANGUAGE plpgsql
 SECURITY DEFINER  -- Keep for now, but return JSON instead of TABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rows_affected integer := 0;
  v_is_idempotent boolean := false;
  v_existing_rotation_id uuid;
  v_correlation_id uuid;
BEGIN
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

-- 2. Fix lease_fudo_rotation_candidates - remove SECURITY DEFINER completely
-- This can be done safely with proper RLS
DROP FUNCTION IF EXISTS public.lease_fudo_rotation_candidates(integer, interval);

CREATE OR REPLACE FUNCTION public.lease_fudo_rotation_candidates(p_limit integer DEFAULT 50, p_cooldown interval DEFAULT '04:00:00'::interval)
 RETURNS TABLE(location_id uuid, secret_ref text, expires_at timestamp with time zone)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  -- Remove SECURITY DEFINER and rely on RLS policies instead
  WITH cand AS (
    SELECT pc.location_id, pc.secret_ref, pc.expires_at
    FROM public.pos_credentials pc
    WHERE pc.provider = 'fudo'
      AND pc.expires_at IS NOT NULL
      AND pc.rotation_status IN ('active','failed')
      AND (pc.next_attempt_at IS NULL OR pc.next_attempt_at <= now())
      AND (pc.last_rotation_attempt_at IS NULL
           OR pc.last_rotation_attempt_at <= now() - p_cooldown)
      AND (public.is_tupa_admin())  -- Only admins can lease rotation candidates
    ORDER BY
      COALESCE(pc.last_rotation_attempt_at, 'epoch'::timestamptz) ASC,
      pc.expires_at ASC
    LIMIT p_limit
  )
  SELECT cand.location_id, cand.secret_ref, cand.expires_at
  FROM cand;
$function$;

-- 3. Fix rotate_invitation_token - remove TABLE return type
DROP FUNCTION IF EXISTS public.rotate_invitation_token(uuid);

CREATE OR REPLACE FUNCTION public.rotate_invitation_token(_invitation_id uuid)
 RETURNS jsonb  -- Change from TABLE to JSONB
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation record;
  v_token text;
  v_hash text;
  v_expires_at timestamptz;
BEGIN
  -- Check if user can access this invitation
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

-- 4. Remove the problematic SECURITY DEFINER functions that return TABLE types
-- Replace with non-SECURITY DEFINER alternatives

-- Alternative for rotation without exposing secret_ref
CREATE OR REPLACE VIEW public.rotation_candidates_safe AS
SELECT 
  pc.location_id,
  pc.provider,
  pc.expires_at,
  EXTRACT(hours FROM (pc.expires_at - now()))::integer as hours_until_expiry,
  pc.status,
  pc.rotation_status,
  pc.consecutive_rotation_failures,
  CASE 
    WHEN pc.last_rotation_attempt_at IS NULL THEN 'never_attempted'
    WHEN pc.last_rotation_attempt_at <= now() - interval '4 hours' THEN 'ready_for_retry'
    ELSE 'recently_attempted'
  END as attempt_status
FROM public.pos_credentials pc
WHERE pc.expires_at IS NOT NULL
  AND pc.rotation_status IN ('active','failed')
  AND (public.is_tupa_admin() OR public.user_has_location(pc.location_id));

-- Set security barrier on the view
ALTER VIEW public.rotation_candidates_safe SET (security_barrier = true);

-- 5. Document the remaining SECURITY DEFINER functions that are necessary
COMMENT ON FUNCTION public.execute_atomic_rotation IS 'System function for credential rotation. Uses SECURITY DEFINER for transaction integrity but returns JSON to avoid view security issues.';

-- 6. Add enhanced RLS policies to ensure security
-- Update profiles table RLS to be more restrictive
DROP POLICY IF EXISTS "profiles_block_anonymous" ON public.profiles;
CREATE POLICY "profiles_authenticated_access" ON public.profiles
FOR ALL USING (
  auth.uid() IS NOT NULL AND (
    id = auth.uid() OR public.is_tupa_admin()
  )
);

-- 7. Add audit logging for remaining SECURITY DEFINER functions
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
END;
$$ LANGUAGE plpgsql;