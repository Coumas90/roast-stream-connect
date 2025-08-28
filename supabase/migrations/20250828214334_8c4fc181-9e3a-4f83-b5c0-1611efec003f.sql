-- Comprehensive check for what might still be triggering the Security Definer View linter error

-- 1. Check ALL views (not just functions) for SECURITY DEFINER
SELECT 
  'VIEW' as object_type,
  schemaname as schema_name,
  viewname as object_name,
  'N/A' as arguments,
  'VIEW_SECURITY_DEFINER' as issue_type
FROM pg_views 
WHERE schemaname = 'public'
  AND definition ILIKE '%SECURITY DEFINER%'

UNION ALL

-- 2. Check for any remaining SECURITY DEFINER functions that return sets (table-like)
SELECT 
  'FUNCTION' as object_type,
  n.nspname as schema_name,
  p.proname as object_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  'FUNCTION_SECURITY_DEFINER_TABLE' as issue_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true  
  AND p.proretset = true

UNION ALL

-- 3. Check for any functions with SECURITY DEFINER that might be interpreted as views
SELECT 
  'FUNCTION_SCALAR' as object_type,
  n.nspname as schema_name,
  p.proname as object_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  'FUNCTION_SECURITY_DEFINER_SCALAR' as issue_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true  
  AND p.proretset = false
  AND p.proname ILIKE '%view%'

ORDER BY object_type, object_name;