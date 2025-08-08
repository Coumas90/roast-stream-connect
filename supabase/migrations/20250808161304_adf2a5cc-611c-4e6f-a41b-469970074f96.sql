begin;
-- Fix linter warning: set search_path for trigger function
ALTER FUNCTION public.set_updated_at() SET search_path = public;
commit;