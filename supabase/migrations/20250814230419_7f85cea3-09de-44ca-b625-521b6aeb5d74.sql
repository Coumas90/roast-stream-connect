-- Fix functions missing explicit search_path settings
-- Local timeouts for this migration
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';

-- Fix normalize_email function (trigger function)
CREATE OR REPLACE FUNCTION public.normalize_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.email is not null then
    new.email := lower(new.email);
  end if;
  return new;
end;
$function$;

-- Verify the fix by checking remaining functions without search_path
SELECT 'Functions without explicit search_path in public schema:' AS status;
SELECT n.nspname AS schema,
       p.proname  AS name,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE (p.proconfig IS NULL
       OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) g WHERE g LIKE 'search_path%'))
  AND n.nspname = 'public'
ORDER BY p.proname;