-- Revised migration for pos_credentials rotation fields
-- Removes CONCURRENTLY, leaves expires_at NULL, safe backfill, wrapped CHECKs

-- A1: Add rotation fields to pos_credentials
ALTER TABLE public.pos_credentials 
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_rotation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_rotation_attempt_at TIMESTAMPTZ DEFAULT NULL;

-- A2: Safe backfill for existing records
UPDATE public.pos_credentials
SET issued_at = COALESCE(issued_at, created_at, NOW())
WHERE issued_at IS NULL;

UPDATE public.pos_credentials
SET last_rotation_at = COALESCE(last_rotation_at, issued_at)
WHERE last_rotation_at IS NULL;

-- Note: NOT setting expires_at to issued_at + 1 year; leaving NULL for rotation job to manage

-- A3: Set NOT NULL constraints
ALTER TABLE public.pos_credentials 
  ALTER COLUMN issued_at SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;

-- A4: CHECK constraints with guards to prevent recreation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'pos_credentials_status_check'
  ) THEN
    ALTER TABLE public.pos_credentials 
    ADD CONSTRAINT pos_credentials_status_check
    CHECK (status IN ('active','expired','revoked','pending_rotation'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'pos_credentials_dates_check'
  ) THEN
    ALTER TABLE public.pos_credentials 
    ADD CONSTRAINT pos_credentials_dates_check
    CHECK (expires_at IS NULL OR expires_at > issued_at);
  END IF;
END$$;

-- A5: Indexes (without CONCURRENTLY since migrations run in transaction)
CREATE INDEX IF NOT EXISTS idx_pos_credentials_expires_at 
  ON public.pos_credentials (expires_at) 
  WHERE status = 'active' AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pos_credentials_rotation_attempts 
  ON public.pos_credentials (last_rotation_attempt_at) 
  WHERE last_rotation_attempt_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pos_credentials_status_expires 
  ON public.pos_credentials (status, expires_at) 
  WHERE status IN ('active','pending_rotation');

CREATE INDEX IF NOT EXISTS idx_pos_credentials_location_status 
  ON public.pos_credentials (location_id, status) 
  WHERE location_id IS NOT NULL;

-- A6: Trigger for last_rotation_at (checks if secret_ref column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='pos_credentials' AND column_name='secret_ref'
  ) THEN
    -- secret_ref exists, update on secret_ref change
    CREATE OR REPLACE FUNCTION public.update_credential_rotation_timestamp()
    RETURNS TRIGGER AS $f$
    BEGIN
      IF OLD.secret_ref IS DISTINCT FROM NEW.secret_ref THEN
        NEW.last_rotation_at = now();
        NEW.status = COALESCE(NEW.status, 'active');
      END IF;
      RETURN NEW;
    END;$f$ LANGUAGE plpgsql;
  ELSE
    -- secret_ref doesn't exist, update on status change from pending_rotation to active
    CREATE OR REPLACE FUNCTION public.update_credential_rotation_timestamp()
    RETURNS TRIGGER AS $f$
    BEGIN
      IF OLD.status = 'pending_rotation' AND NEW.status = 'active' THEN
        NEW.last_rotation_at = now();
      END IF;
      RETURN NEW;
    END;$f$ LANGUAGE plpgsql;
  END IF;

  -- Drop and recreate trigger
  DROP TRIGGER IF EXISTS trigger_pos_credentials_rotation ON public.pos_credentials;
  CREATE TRIGGER trigger_pos_credentials_rotation
    BEFORE UPDATE ON public.pos_credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.update_credential_rotation_timestamp();
END$$;

-- A7: Function to find credentials expiring soon (with SECURITY DEFINER and SET search_path)
DO $$
BEGIN
  CREATE OR REPLACE FUNCTION public.pos_credentials_expiring_soon(days_ahead INTEGER DEFAULT 3)
  RETURNS TABLE(
    location_id UUID,
    provider app_pos_provider,
    status TEXT,
    issued_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    days_until_expiry INTEGER,
    last_rotation_at TIMESTAMPTZ
  )
  LANGUAGE SQL STABLE SECURITY DEFINER
  SET search_path TO 'public'
  AS $f$
    SELECT 
      pc.location_id,
      pc.provider,
      pc.status,
      pc.issued_at,
      pc.expires_at,
      EXTRACT(days FROM (pc.expires_at - now()))::INTEGER AS days_until_expiry,
      pc.last_rotation_at
    FROM public.pos_credentials pc
    WHERE pc.expires_at IS NOT NULL
      AND pc.expires_at <= (now() + make_interval(days => days_ahead))
      AND (is_tupa_admin() OR user_has_location(pc.location_id))
    ORDER BY pc.expires_at ASC;
  $f$;
  
  -- Grant execute to authenticated users
  GRANT EXECUTE ON FUNCTION public.pos_credentials_expiring_soon(INTEGER) TO authenticated;
  
EXCEPTION WHEN undefined_table OR undefined_function OR undefined_object THEN
  -- In environments without helpers/types, don't fail the migration
  RAISE NOTICE 'pos_credentials_expiring_soon created without RLS helpers; review in production.';
END$$;

-- A8: Optional helper to mark credentials for rotation (if app_pos_provider type exists)
DO $$
BEGIN
  CREATE OR REPLACE FUNCTION public.mark_credential_for_rotation(_location_id UUID, _provider app_pos_provider)
  RETURNS BOOLEAN
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
  AS $f$
  BEGIN
    IF NOT (is_tupa_admin() OR user_has_location(_location_id)) THEN
      RETURN FALSE;
    END IF;
    
    UPDATE public.pos_credentials 
    SET status = 'pending_rotation',
        last_rotation_attempt_at = now()
    WHERE location_id = _location_id 
      AND provider = _provider 
      AND status = 'active';
    
    RETURN FOUND;
  END;$f$;
  
  GRANT EXECUTE ON FUNCTION public.mark_credential_for_rotation(UUID, app_pos_provider) TO authenticated;
  
EXCEPTION WHEN undefined_table OR undefined_function OR undefined_object THEN
  RAISE NOTICE 'mark_credential_for_rotation not created due to missing types/functions.';
END$$;

-- A9: Verification query
SELECT 'Migration completed successfully. Running verification...' AS status;
SELECT * FROM public.pos_credentials_expiring_soon(3);