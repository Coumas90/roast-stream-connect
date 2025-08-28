-- Analyze the remaining SECURITY DEFINER table functions to determine if they can be safely converted

-- Let's examine what these functions actually do:

-- 1. claim_job_lock - Job management (likely needs SECURITY DEFINER)
SELECT 'claim_job_lock' as function_name, 'Administrative job locking mechanism' as purpose;

-- 2. create_location_invitation - Creates invitations (might be convertible) 
SELECT 'create_location_invitation' as function_name, 'Creates user invitations for locations' as purpose;

-- 3. execute_atomic_rotation - Critical credential rotation (MUST stay SECURITY DEFINER)
SELECT 'execute_atomic_rotation' as function_name, 'Atomic credential rotation - CRITICAL SECURITY' as purpose;

-- 4. lease_fudo_rotation_candidates - System operation (likely needs SECURITY DEFINER)
SELECT 'lease_fudo_rotation_candidates' as function_name, 'System credential rotation management' as purpose;

-- 5. rotate_invitation_token - Token management (might be convertible)
SELECT 'rotate_invitation_token' as function_name, 'Rotates invitation tokens' as purpose;

-- Let's check if any of these functions are actually used like views (for read-only data display)
-- vs. operational functions that modify data

SELECT 
  p.proname as function_name,
  CASE 
    WHEN p.proname LIKE '%lock%' THEN 'SYSTEM_OPERATION'
    WHEN p.proname LIKE '%atomic%' THEN 'CRITICAL_SECURITY' 
    WHEN p.proname LIKE '%lease%' THEN 'SYSTEM_OPERATION'
    WHEN p.proname LIKE '%invitation%' THEN 'USER_MANAGEMENT'
    ELSE 'OTHER'
  END as function_category,
  CASE 
    WHEN p.proname IN ('execute_atomic_rotation', 'lease_fudo_rotation_candidates', 'claim_job_lock') 
    THEN 'MUST_STAY_SECURITY_DEFINER'
    ELSE 'POTENTIALLY_CONVERTIBLE'
  END as conversion_recommendation
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true  
  AND p.proretset = true
  AND p.proname IN ('claim_job_lock', 'create_location_invitation', 'execute_atomic_rotation', 'lease_fudo_rotation_candidates', 'rotate_invitation_token');