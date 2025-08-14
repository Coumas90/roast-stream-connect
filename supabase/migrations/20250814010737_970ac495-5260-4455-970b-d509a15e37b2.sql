-- Remove the security definer view that's causing the linter error
DROP VIEW IF EXISTS public.pos_provider_credentials_safe;