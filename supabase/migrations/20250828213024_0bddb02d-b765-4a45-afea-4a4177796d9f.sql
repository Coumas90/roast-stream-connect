-- Check if any views are explicitly created with SECURITY DEFINER
-- (Most views are implicitly SECURITY INVOKER unless explicitly set)
SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views 
WHERE schemaname = 'public'
  AND (definition ILIKE '%SECURITY DEFINER%' OR definition ILIKE '%security definer%');

-- Check for materialized views that might have SECURITY DEFINER
SELECT 
  schemaname,
  matviewname as viewname,
  definition
FROM pg_matviews 
WHERE schemaname = 'public';

-- The issue is likely that we need to identify the problematic view functions
-- Let's check the dashboard views that return table data and might be seen as "views"
SELECT 
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_result(p.oid) AS return_type,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proretset = true  -- Returns a set (table-like)
  AND p.prosecdef = true  -- SECURITY DEFINER
  AND p.proname LIKE '%dashboard%'
ORDER BY p.proname;