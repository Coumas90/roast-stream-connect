-- Find remaining SECURITY DEFINER table functions that act like views
WITH view_like_functions AS (
  SELECT 
    n.nspname AS schema_name,
    p.proname AS function_name,
    CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security_type,
    p.proretset as returns_table,
    pg_get_function_result(p.oid) AS return_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proretset = true  -- Returns a set (table-like, view-like)
    AND p.prosecdef = true  -- SECURITY DEFINER
    AND p.proname NOT LIKE '%trigger%'  -- Exclude trigger functions
    AND p.proname NOT LIKE '%audit%'    -- Exclude audit functions that need elevated access
    AND p.proname NOT LIKE '%handle_%'  -- Exclude handlers
    AND p.proname NOT LIKE '%upsert%'   -- Exclude data modification functions
    AND p.proname NOT LIKE '%create_%'  -- Exclude creation functions  
    AND p.proname NOT LIKE '%connect_%' -- Exclude connection functions
    AND p.proname NOT LIKE '%accept_%'  -- Exclude acceptance functions
    AND p.proname NOT LIKE '%assign_%'  -- Exclude assignment functions
    AND p.proname NOT LIKE '%revoke_%'  -- Exclude revocation functions
    AND p.proname NOT LIKE '%record_%'  -- Exclude recording functions
    AND p.proname NOT LIKE '%execute_%' -- Exclude execution functions
    AND p.proname NOT LIKE '%update_%'  -- Exclude update functions
    AND p.proname NOT LIKE '%mark_%'    -- Exclude marking functions
    AND p.proname NOT LIKE '%reset_%'   -- Exclude reset functions
    AND p.proname NOT LIKE '%rotate_%'  -- Exclude rotation functions
    AND p.proname NOT LIKE '%lease_%'   -- Exclude lease functions
    AND p.proname NOT LIKE '%claim_%'   -- Exclude claim functions
    AND p.proname NOT LIKE '%release_%' -- Exclude release functions
    AND p.proname NOT LIKE '%renew_%'   -- Exclude renew functions
    AND p.proname NOT LIKE '%resolve_%' -- Exclude resolve functions
    AND p.proname NOT LIKE '%acknowledge_%' -- Exclude acknowledge functions
    AND p.proname NOT LIKE '%complete_%' -- Exclude complete functions
    AND p.proname NOT LIKE '%start_%'   -- Exclude start functions
    AND p.proname NOT LIKE '%run_%'     -- Exclude run functions
    AND p.proname NOT LIKE '%trigger_%' -- Exclude trigger functions
    AND p.proname NOT LIKE '%gc_%'      -- Exclude garbage collection functions
    AND p.proname NOT LIKE '%set_%'     -- Exclude setter functions
    AND p.proname NOT LIKE '%log_%'     -- Exclude logging functions
    AND p.proname NOT LIKE '%normalize_%' -- Exclude normalization functions
    AND p.proname NOT LIKE '%cb_%'      -- Exclude circuit breaker functions
    AND p.proname NOT LIKE '%check_%'   -- Exclude check functions that are operational
  ORDER BY p.proname
)
SELECT * FROM view_like_functions;

-- Check if we have created any actual views with SECURITY DEFINER
SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views 
WHERE schemaname = 'public'
  AND definition ILIKE '%SECURITY DEFINER%';