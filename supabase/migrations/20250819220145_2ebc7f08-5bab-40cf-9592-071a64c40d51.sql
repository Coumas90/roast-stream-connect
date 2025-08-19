-- Create optimized index for Fudo credential selection
CREATE INDEX IF NOT EXISTS pos_credentials_fudo_attempt_idx
  ON public.pos_credentials (provider, last_rotation_attempt_at, expires_at)
  WHERE provider = 'fudo';

-- Add UNIQUE constraint on job_heartbeats.job_name for stable UPSERT
ALTER TABLE public.job_heartbeats 
ADD CONSTRAINT job_heartbeats_job_name_unique UNIQUE (job_name);

-- Create atomic leasing function that selects and marks in one operation
CREATE OR REPLACE FUNCTION public.lease_fudo_rotation_candidates(
  p_limit int DEFAULT 50,
  p_cooldown interval DEFAULT '4 hours'
)
RETURNS TABLE (location_id uuid, secret_ref text, expires_at timestamp with time zone)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  RETURNING pc.location_id, cand.secret_ref, cand.expires_at;
$$;

-- Grant execution permission to service_role
GRANT EXECUTE ON FUNCTION public.lease_fudo_rotation_candidates(int, interval) TO service_role;