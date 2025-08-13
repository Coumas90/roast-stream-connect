-- Find all views with SECURITY DEFINER property
SELECT schemaname, viewname, definition 
FROM pg_views 
WHERE schemaname = 'public' 
AND definition ILIKE '%security definer%';

-- Also check for any functions that might be incorrectly created as views
SELECT routine_name, routine_type, security_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND security_type = 'DEFINER';