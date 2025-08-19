-- Apply the 3 critical adjustments for production-ready atomic leasing

-- 1. Fix the lease function to re-check conditions in UPDATE to prevent race conditions
CREATE OR REPLACE FUNCTION public.lease_fudo_rotation_candidates(p_limit integer DEFAULT 50, p_cooldown interval DEFAULT '04:00:00'::interval)
 RETURNS TABLE(location_id uuid, secret_ref text, expires_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cand AS (
    SELECT pc.location_id, pc.secret_ref, pc.expires_at
    FROM public.pos_credentials pc
    WHERE pc.provider = 'fudo'
      AND pc.expires_at IS NOT NULL
      AND pc.rotation_status IN ('active','failed')
      -- Respect circuit breaker: only if next_attempt_at is NULL or in the past
      AND (pc.next_attempt_at IS NULL OR pc.next_attempt_at <= now())
      -- 4-hour cooldown: only if never attempted OR last attempt > 4 hours ago
      AND (pc.last_rotation_attempt_at IS NULL
           OR pc.last_rotation_attempt_at <= now() - p_cooldown)
    ORDER BY
      -- Priority: never attempted first, then by expiry urgency
      COALESCE(pc.last_rotation_attempt_at, 'epoch'::timestamptz) ASC,
      pc.expires_at ASC
    LIMIT p_limit
  )
  UPDATE public.pos_credentials pc
  SET last_rotation_attempt_at = now(),
      updated_at = now()
  FROM cand
  WHERE pc.provider = 'fudo'
    AND pc.location_id = cand.location_id
    -- CRITICAL: Re-check breaker and cooldown conditions in the UPDATE to prevent race conditions
    AND (pc.next_attempt_at IS NULL OR pc.next_attempt_at <= now())
    AND (pc.last_rotation_attempt_at IS NULL
         OR pc.last_rotation_attempt_at <= now() - p_cooldown)
  RETURNING pc.location_id, cand.secret_ref, cand.expires_at;
$function$;

-- 2. Add partial index for circuit breaker scaling
CREATE INDEX IF NOT EXISTS pos_credentials_fudo_breaker_idx
  ON public.pos_credentials (provider, next_attempt_at)
  WHERE provider = 'fudo' AND next_attempt_at IS NOT NULL;

-- 3. Add UNIQUE constraint on heartbeats using concurrent approach (production-safe)
-- First create the unique index concurrently
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS job_heartbeats_job_name_uidx
  ON public.job_heartbeats(job_name);

-- Then add the constraint using the index
ALTER TABLE public.job_heartbeats
  ADD CONSTRAINT job_heartbeats_job_name_unique
  UNIQUE USING INDEX job_heartbeats_job_name_uidx;