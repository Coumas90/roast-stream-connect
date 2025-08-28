-- Final comprehensive check for ANY remaining SECURITY DEFINER views or view-like functions
-- that could be causing the linter error

-- 1. Check for actual database VIEWS with SECURITY DEFINER
SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views 
WHERE schemaname = 'public'
  AND definition ILIKE '%SECURITY DEFINER%';

-- 2. Check if the linter might be detecting materialized views
SELECT 
  schemaname,
  matviewname as viewname,
  definition
FROM pg_matviews 
WHERE schemaname = 'public'
  AND definition ILIKE '%SECURITY DEFINER%';

-- 3. Check for any remaining SECURITY DEFINER functions that return sets
SELECT 
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security_type,
  p.proretset as returns_table
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true  
  AND p.proretset = true
ORDER BY p.proname;

-- 4. Final verification - this should return 0 rows if we fixed everything
SELECT COUNT(*) as remaining_security_definer_view_functions
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true  
  AND p.proretset = true
  -- Exclude legitimate operational functions that need SECURITY DEFINER
  AND p.proname NOT IN (
    'assign_role_by_email', 'revoke_role_by_email', 'connect_pos_location',
    'create_location_invitation', 'accept_invitation', 'handle_new_user',
    'upsert_consumption', 'mark_credential_for_rotation', 'mark_rotation_attempt',
    'reset_rotation_failures', 'update_credential_rotation_timestamp',
    'update_job_heartbeat', 'update_pos_setting', 'lease_fudo_rotation_candidates',
    'execute_atomic_rotation', 'secure_token_rotation', 'set_pos_location',
    'set_pos_tenant', 'trigger_pos_credentials_rotation', 'audit_credential_access',
    'audit_pos_credentials_access', 'log_pos_credential_access', 
    'record_alert_incident', 'record_chaos_metric', 'record_rotation_metric',
    'acknowledge_alert_incident', 'resolve_alert_incident', 'start_chaos_test',
    'complete_chaos_test', 'claim_job_lock', 'release_job_lock', 'renew_job_lock',
    'rotate_invitation_token', 'revoke_invitation', 
    'run_pos_rotation', 'run_scheduled_gc', 'gc_pos_rotation_metrics_batched',
    'normalize_email', 'log_invitation_event', 'is_alert_in_cooldown'
  );