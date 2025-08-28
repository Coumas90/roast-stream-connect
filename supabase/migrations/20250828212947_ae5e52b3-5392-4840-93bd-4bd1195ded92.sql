-- Find all views with SECURITY DEFINER
SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views 
WHERE schemaname = 'public';

-- Check for SECURITY DEFINER functions that might be masquerading as views
SELECT 
  n.nspname AS schema_name,
  p.proname AS function_name,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security_type,
  CASE WHEN p.prorettype = 'record'::regtype OR p.proretset THEN 'TABLE_FUNCTION' ELSE 'SCALAR_FUNCTION' END AS function_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname;