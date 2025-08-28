-- Check if there are still any SECURITY DEFINER functions remaining
-- that might be causing the linter error

-- Find any remaining SECURITY DEFINER functions with two versions (overloaded)
SELECT 
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security_type,
  p.proretset as returns_table
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'get_fudo_credentials_expiring'
  AND p.prosecdef = true
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);

-- Also check if there are any other duplicate SECURITY DEFINER functions
SELECT 
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND p.proname IN (
    SELECT proname 
    FROM pg_proc 
    WHERE pronamespace = n.oid 
    GROUP BY proname 
    HAVING COUNT(*) > 1
  )
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);