-- Final comprehensive check for any remaining SECURITY DEFINER view-like functions
-- This should return NO results if we've fixed everything

SELECT 
  'SECURITY_DEFINER_VIEW_LIKE_FUNCTIONS' as category,
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security_type,
  p.proretset as returns_table
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true  -- SECURITY DEFINER
  AND p.proretset = true  -- Returns table (view-like)
  -- Only include functions that are clearly view-like (data retrieval)
  AND (
    p.proname LIKE 'get_%'
    OR p.proname LIKE 'list_%' 
    OR p.proname LIKE 'check_%'
    OR p.proname LIKE 'calculate_%'
    OR p.proname LIKE '%_public'
    OR p.proname LIKE '%_safe'
    OR p.proname LIKE '%_summary'
    OR p.proname LIKE '%_expiring%'
    OR p.proname LIKE 'effective_%'
  )

UNION ALL

-- Also check for any SECURITY DEFINER views (unlikely but possible)
SELECT 
  'SECURITY_DEFINER_VIEWS' as category,
  schemaname AS schema_name,
  viewname AS function_name,
  'N/A' AS arguments,
  'SECURITY DEFINER' AS security_type,
  true as returns_table
FROM pg_views 
WHERE schemaname = 'public'
  AND definition ILIKE '%SECURITY DEFINER%'

ORDER BY category, function_name;