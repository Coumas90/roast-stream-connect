-- Check for any actual views (not functions) in the public schema
SELECT schemaname, viewname, definition 
FROM pg_views 
WHERE schemaname = 'public';