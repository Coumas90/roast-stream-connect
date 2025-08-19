-- Card 8: Add rotation_id to pos_credentials for end-to-end traceability
-- This complements the existing effective idempotency via pos_provider_credentials.rotation_attempt_id

-- Add rotation_id column for auditing/tracing the last rotation attempt
ALTER TABLE public.pos_credentials
  ADD COLUMN IF NOT EXISTS rotation_id uuid;

COMMENT ON COLUMN public.pos_credentials.rotation_id
  IS 'Último rotation_id procesado para auditoría/trace. La idempotencia efectiva se aplica en pos_provider_credentials.rotation_attempt_id.';

-- Verify that the effective idempotency constraint exists (this should already be there)
-- This ensures pos_provider_credentials has the unique constraint needed for effective idempotency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'pos_provider_credentials' 
    AND indexname LIKE '%rotation_attempt%'
  ) THEN
    -- Create the effective idempotency constraint if missing
    CREATE UNIQUE INDEX pos_cred_attempt_uniq
      ON public.pos_provider_credentials(provider, location_id, rotation_attempt_id)
      WHERE rotation_attempt_id IS NOT NULL;
    
    COMMENT ON INDEX public.pos_cred_attempt_uniq 
      IS 'Effective idempotency constraint: prevents duplicate swaps for same rotation_attempt_id';
  END IF;
END;
$$;