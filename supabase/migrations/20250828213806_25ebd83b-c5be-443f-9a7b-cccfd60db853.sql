-- Let me check for any remaining circuit breaker functions that might be problematic
-- and attempt to run the linter again to see if there are still issues

-- Let me do a more comprehensive check to see what's still causing the security linter to fail
SELECT 
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security_type,
  p.proretset as returns_table,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true  -- SECURITY DEFINER
  AND p.proretset = true  -- Returns table (view-like)
  AND p.proname NOT IN (
    -- Exclude operational functions that legitimately need SECURITY DEFINER
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
    'rotate_invitation_token', 'revoke_invitation', 'list_location_invitations',
    'run_pos_rotation', 'run_scheduled_gc', 'gc_pos_rotation_metrics_batched',
    'normalize_email', 'log_invitation_event', 'is_alert_in_cooldown'
  )
ORDER BY p.proname;