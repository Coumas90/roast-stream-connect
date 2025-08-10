-- Enable required crypto functions for invitations
-- Provides gen_random_bytes, gen_random_uuid, digest, etc.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;