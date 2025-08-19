-- Card 8: Add rotation_id to pos_credentials for end-to-end traceability
-- This complements the existing effective idempotency via pos_provider_credentials.rotation_attempt_id

-- Add rotation_id column for auditing/tracing the last rotation attempt
ALTER TABLE public.pos_credentials
  ADD COLUMN IF NOT EXISTS rotation_id uuid;

COMMENT ON COLUMN public.pos_credentials.rotation_id
  IS 'Último rotation_id procesado para auditoría/trace. La idempotencia efectiva se aplica en pos_provider_credentials.rotation_attempt_id.';