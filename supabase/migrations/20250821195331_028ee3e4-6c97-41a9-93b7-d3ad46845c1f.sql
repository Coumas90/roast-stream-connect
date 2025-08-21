-- Critical performance indexes for POS Dashboard (Card 13)
-- Execute during off-peak hours for optimal performance

-- Index for MTTR calculation - accelerates rotation event queries
CREATE INDEX IF NOT EXISTS pos_logs_rotation_idx 
  ON public.pos_logs(provider, location_id, ts) 
  WHERE scope = 'rotation';

-- Index for credentials expiration queries - accelerates dashboard expirations view
CREATE INDEX IF NOT EXISTS idx_pos_credentials_expires_at 
  ON public.pos_credentials(expires_at) 
  WHERE expires_at IS NOT NULL;

-- Comment for operational context
COMMENT ON INDEX pos_logs_rotation_idx IS 'Optimizes MTTR calculation queries by filtering rotation events and ordering by timestamp';
COMMENT ON INDEX idx_pos_credentials_expires_at IS 'Optimizes credentials expiration dashboard queries for non-null expiration dates';