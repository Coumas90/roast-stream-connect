-- Migration: Add credential rotation fields to pos_credentials
-- Date: 2025-01-14
-- Purpose: Add rotation tracking and expiration management for POS credentials

-- Add new columns with safe defaults
ALTER TABLE public.pos_credentials 
ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_rotation_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS last_rotation_attempt_at TIMESTAMPTZ DEFAULT NULL;

-- Safe backfill for existing records
-- Set issued_at to created_at for existing records
UPDATE public.pos_credentials 
SET issued_at = created_at 
WHERE issued_at IS NULL;

-- Set expires_at to 1 year from issued_at for existing active credentials
UPDATE public.pos_credentials 
SET expires_at = issued_at + INTERVAL '1 year'
WHERE expires_at IS NULL AND status = 'active';

-- Set last_rotation_at to created_at for existing records (initial creation = first rotation)
UPDATE public.pos_credentials 
SET last_rotation_at = created_at 
WHERE last_rotation_at IS NULL;

-- Add NOT NULL constraints after backfill
ALTER TABLE public.pos_credentials 
ALTER COLUMN issued_at SET NOT NULL,
ALTER COLUMN status SET NOT NULL;

-- Add check constraint for valid status values
ALTER TABLE public.pos_credentials 
ADD CONSTRAINT pos_credentials_status_check 
CHECK (status IN ('active', 'expired', 'revoked', 'pending_rotation'));

-- Add check constraint for logical date ordering
ALTER TABLE public.pos_credentials 
ADD CONSTRAINT pos_credentials_dates_check 
CHECK (expires_at IS NULL OR expires_at > issued_at);

-- Create indexes for efficient querying
-- Index for finding credentials expiring soon
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pos_credentials_expires_at 
ON public.pos_credentials (expires_at) 
WHERE status = 'active' AND expires_at IS NOT NULL;

-- Index for rotation attempt tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pos_credentials_rotation_attempts 
ON public.pos_credentials (last_rotation_attempt_at) 
WHERE last_rotation_attempt_at IS NOT NULL;

-- Composite index for status and expiration queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pos_credentials_status_expires 
ON public.pos_credentials (status, expires_at) 
WHERE status IN ('active', 'pending_rotation');

-- Index for location-based credential management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pos_credentials_location_status 
ON public.pos_credentials (location_id, status) 
WHERE location_id IS NOT NULL;

-- Add trigger to automatically update last_rotation_at when secret_ref changes
CREATE OR REPLACE FUNCTION public.update_credential_rotation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- If secret_ref changed, update rotation timestamp
  IF OLD.secret_ref IS DISTINCT FROM NEW.secret_ref THEN
    NEW.last_rotation_at = now();
    NEW.status = COALESCE(NEW.status, 'active');
  END IF;
  
  -- Always update updated_at
  NEW.updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_pos_credentials_rotation ON public.pos_credentials;
CREATE TRIGGER trigger_pos_credentials_rotation
  BEFORE UPDATE ON public.pos_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_credential_rotation_timestamp();

-- Verification query function
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
LANGUAGE SQL 
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    pc.location_id,
    pc.provider,
    pc.status,
    pc.issued_at,
    pc.expires_at,
    EXTRACT(days FROM (pc.expires_at - now()))::INTEGER as days_until_expiry,
    pc.last_rotation_at
  FROM public.pos_credentials pc
  WHERE pc.expires_at IS NOT NULL
    AND pc.expires_at <= (now() + make_interval(days => days_ahead))
    AND pc.status = 'active'
    AND (is_tupa_admin() OR user_has_location(pc.location_id))
  ORDER BY pc.expires_at ASC;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.pos_credentials_expiring_soon(INTEGER) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.pos_credentials_expiring_soon(INTEGER) IS 
'Returns POS credentials that will expire within the specified number of days (default 3). Respects RLS policies.';

-- Verification: Test the new functionality
-- This query can be run to verify the migration worked correctly
-- SELECT * FROM public.pos_credentials_expiring_soon(3);

-- Additional helper function for credential rotation management
CREATE OR REPLACE FUNCTION public.mark_credential_for_rotation(
  _location_id UUID,
  _provider app_pos_provider
) 
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check permissions
  IF NOT (is_tupa_admin() OR user_can_manage_pos(_location_id)) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Mark credential for rotation
  UPDATE public.pos_credentials 
  SET 
    status = 'pending_rotation',
    last_rotation_attempt_at = now(),
    updated_at = now()
  WHERE location_id = _location_id 
    AND provider = _provider
    AND status = 'active';
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active credential found for location % and provider %', _location_id, _provider;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_credential_for_rotation(UUID, app_pos_provider) TO authenticated;