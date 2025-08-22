-- =============================================
-- SANDBOX SEEDING SCRIPT FOR UAT TESTING
-- =============================================
-- 
-- Purpose: Set up controlled test scenarios for Token Zombie UAT
-- Owner: @qa-team, @sre-team
-- Usage: Execute in test/sandbox environment ONLY
--
-- CRITICAL: NEVER run this in production!
-- =============================================

-- Environment safety check
DO $$
BEGIN
  IF current_setting('application_name') LIKE '%prod%' OR 
     current_setting('cluster_name') LIKE '%prod%' THEN
    RAISE EXCEPTION 'ABORT: This script cannot be run in production environment';
  END IF;
END $$;

-- =============================================
-- 1. SANDBOX TENANT & LOCATION SETUP
-- =============================================

-- Create sandbox tenant if not exists
INSERT INTO public.tenants (id, name, slug, created_at)
VALUES (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  'UAT Sandbox Tenant',
  'uat-sandbox',
  now()
) ON CONFLICT (id) DO NOTHING;

-- Create sandbox location for testing
INSERT INTO public.locations (id, tenant_id, name, code, timezone, created_at)
VALUES (
  'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'::uuid,
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  'UAT Test Location',
  'UAT-001',
  'UTC',
  now()
) ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 2. CREDENTIAL SCENARIOS FOR TOKEN ZOMBIE TESTING
-- =============================================

-- Scenario A: Credential about to expire (5 minutes)
INSERT INTO public.pos_credentials (
  id,
  tenant_id,
  location_id,
  provider,
  secret_ref,
  status,
  rotation_status,
  issued_at,
  expires_at,
  last_rotation_at,
  consecutive_rotation_failures,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'::uuid,
  'fudo'::app_pos_provider,
  'sandbox/fudo/location/bbbbbbbb-cccc-dddd-eeee-ffffffffffff/expiring',
  'active',
  'active',
  now() - interval '25 minutes',  -- Issued 25 min ago
  now() + interval '5 minutes',   -- Expires in 5 minutes
  now() - interval '25 minutes',
  0,
  now(),
  now()
) ON CONFLICT (location_id, provider) 
DO UPDATE SET
  expires_at = now() + interval '5 minutes',
  status = 'active',
  rotation_status = 'active',
  consecutive_rotation_failures = 0,
  updated_at = now();

-- Scenario B: Credential already expired (zombie token scenario)
INSERT INTO public.pos_credentials (
  id,
  tenant_id,
  location_id,
  provider,
  secret_ref,
  status,
  rotation_status,
  issued_at,
  expires_at,
  last_rotation_at,
  consecutive_rotation_failures,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  'cccccccc-dddd-eeee-ffff-000000000000'::uuid,  -- Different location for expired scenario
  'fudo'::app_pos_provider,
  'sandbox/fudo/location/cccccccc-dddd-eeee-ffff-000000000000/expired',
  'expired',
  'failed',
  now() - interval '2 hours',     -- Issued 2 hours ago
  now() - interval '30 minutes',  -- Expired 30 minutes ago
  now() - interval '2 hours',
  3,                              -- 3 consecutive failures
  now(),
  now()
) ON CONFLICT (location_id, provider) 
DO UPDATE SET
  expires_at = now() - interval '30 minutes',
  status = 'expired',
  rotation_status = 'failed',
  consecutive_rotation_failures = 3,
  updated_at = now();

-- Create location for expired scenario
INSERT INTO public.locations (id, tenant_id, name, code, timezone, created_at)
VALUES (
  'cccccccc-dddd-eeee-ffff-000000000000'::uuid,
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  'UAT Expired Token Location',
  'UAT-002',
  'UTC',
  now()
) ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 3. CIRCUIT BREAKER TEST SCENARIOS  
-- =============================================

-- Reset all circuit breakers to closed state for clean testing
DELETE FROM public.rotation_cb WHERE provider = 'fudo';

-- Insert controlled circuit breaker state for testing
INSERT INTO public.rotation_cb (
  provider,
  location_id,
  state,
  failures,
  window_start,
  resume_at,
  created_at,
  updated_at
) VALUES (
  'fudo'::app_pos_provider,
  'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'::uuid,
  'closed',
  0,
  now(),
  NULL,
  now(),
  now()
) ON CONFLICT (provider, location_id) 
DO UPDATE SET
  state = 'closed',
  failures = 0,
  window_start = now(),
  resume_at = NULL,
  updated_at = now();

-- =============================================
-- 4. MONITORING & METRICS BASELINE
-- =============================================

-- Clear old test metrics
DELETE FROM public.pos_rotation_metrics 
WHERE location_id IN (
  'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'::uuid,
  'cccccccc-dddd-eeee-ffff-000000000000'::uuid
) AND recorded_at < now() - interval '1 hour';

-- Insert baseline metrics for comparison
INSERT INTO public.pos_rotation_metrics (
  id,
  location_id,
  provider,
  metric_type,
  value,
  duration_ms,
  job_run_id,
  meta,
  recorded_at
) VALUES (
  gen_random_uuid(),
  'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'::uuid,
  'fudo'::app_pos_provider,
  'baseline_401_response_time',
  1,
  45,  -- 45ms baseline response time
  gen_random_uuid(),
  '{"test_type": "baseline", "scenario": "sandbox_setup"}'::jsonb,
  now()
);

-- =============================================
-- 5. POS INTEGRATIONS SETUP
-- =============================================

-- Enable Fudo integration for sandbox locations
INSERT INTO public.pos_integrations_location (
  id,
  location_id,
  provider,
  connected,
  config,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'::uuid,
  'fudo'::app_pos_provider,
  true,
  '{"sandbox": true, "test_mode": true}'::jsonb,
  now(),
  now()
),
(
  gen_random_uuid(),
  'cccccccc-dddd-eeee-ffff-000000000000'::uuid,
  'fudo'::app_pos_provider,
  false,  -- Disconnected due to expired credentials
  '{"sandbox": true, "test_mode": true, "status": "expired"}'::jsonb,
  now(),
  now()
) ON CONFLICT (location_id, provider) 
DO UPDATE SET
  connected = EXCLUDED.connected,
  config = EXCLUDED.config,
  updated_at = now();

-- =============================================
-- 6. UAT VALIDATION QUERIES
-- =============================================

-- Verify sandbox setup
SELECT 
  'Sandbox Setup Verification' as check_type,
  COUNT(*) as total_test_locations,
  COUNT(*) FILTER (WHERE l.code LIKE 'UAT-%') as uat_locations,
  COUNT(*) FILTER (WHERE pc.expires_at < now() + interval '10 minutes') as expiring_soon,
  COUNT(*) FILTER (WHERE pc.expires_at < now()) as already_expired
FROM public.locations l
LEFT JOIN public.pos_credentials pc ON l.id = pc.location_id
WHERE l.tenant_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid;

-- Verify credential scenarios
SELECT 
  l.code,
  l.name,
  pc.provider,
  pc.status,
  pc.rotation_status,
  EXTRACT(minutes FROM (pc.expires_at - now()))::integer as minutes_until_expiry,
  pc.consecutive_rotation_failures,
  CASE 
    WHEN pc.expires_at < now() THEN 'expired'
    WHEN pc.expires_at < now() + interval '10 minutes' THEN 'expiring_soon'
    ELSE 'valid'
  END as credential_state
FROM public.locations l
JOIN public.pos_credentials pc ON l.id = pc.location_id
WHERE l.tenant_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid
ORDER BY pc.expires_at;

-- Verify circuit breaker states
SELECT 
  cb.provider,
  l.code,
  cb.state,
  cb.failures,
  cb.resume_at
FROM public.rotation_cb cb
JOIN public.locations l ON cb.location_id = l.id
WHERE l.tenant_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid;

-- =============================================
-- 7. CLEANUP COMMANDS (for later)
-- =============================================

-- Uncomment and run to clean up sandbox data after UAT
/*
-- Clean up test data
DELETE FROM public.pos_rotation_metrics 
WHERE location_id IN (
  SELECT id FROM public.locations 
  WHERE tenant_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid
);

DELETE FROM public.rotation_cb 
WHERE location_id IN (
  SELECT id FROM public.locations 
  WHERE tenant_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid
);

DELETE FROM public.pos_integrations_location 
WHERE location_id IN (
  SELECT id FROM public.locations 
  WHERE tenant_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid
);

DELETE FROM public.pos_credentials 
WHERE tenant_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid;

DELETE FROM public.locations 
WHERE tenant_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid;

DELETE FROM public.tenants 
WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid;
*/

-- =============================================
-- SUCCESS MESSAGE
-- =============================================
\echo ''
\echo '✅ SANDBOX SETUP COMPLETE'
\echo ''
\echo 'UAT Test Scenarios Created:'
\echo '  📍 Location UAT-001: Credential expiring in 5 minutes'
\echo '  📍 Location UAT-002: Credential expired (zombie token)'
\echo '  🔄 Circuit breakers: All closed/healthy state'
\echo '  📊 Baseline metrics: Recorded for comparison'
\echo ''
\echo 'Ready for Token Zombie UAT Testing!'
\echo ''