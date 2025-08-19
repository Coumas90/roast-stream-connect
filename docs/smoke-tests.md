# Production Smoke Tests - POS Token Rotation

## Pre-Deployment Validation

### 1. Database Schema Verification
```sql
-- Verify atomic function exists with correct permissions
SELECT 
  p.proname,
  p.prosecdef,
  array_agg(DISTINCT pr.grantee::text) as granted_roles
FROM pg_proc p
LEFT JOIN information_schema.routine_privileges pr 
  ON p.proname = pr.routine_name
WHERE p.proname = 'execute_atomic_rotation'
GROUP BY p.proname, p.prosecdef;

-- Expected: execute_atomic_rotation | t | {service_role}
```

```sql
-- Check rotation_id column exists
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'pos_credentials' 
  AND column_name = 'rotation_id';

-- Expected: pos_credentials | rotation_id | uuid | YES
```

```sql
-- Verify indexes for performance
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename IN ('pos_credentials', 'pos_provider_credentials')
  AND indexname LIKE '%rotation%'
ORDER BY tablename, indexname;

-- Expected: indexes on rotation_id, rotation_attempt_id
```

### 2. Cron Job Configuration
```sql
-- Check no hardcoded URLs remain
SELECT 
  jobname,
  schedule,
  command
FROM cron.job 
WHERE command LIKE '%supabase.co%'
  AND command NOT LIKE '%edge_base_url%';

-- Expected: Empty result (no hardcoded URLs)
```

```sql
-- Verify healthcheck job exists
SELECT 
  jobname,
  schedule,
  active,
  command
FROM cron.job 
WHERE jobname LIKE '%healthcheck%';

-- Expected: cron-healthcheck job with proper schedule
```

## Post-Deployment Smoke Tests

### 3. Atomic Function Testing
```sql
-- Test idempotency with same rotation_id
DO $$
DECLARE
  test_location_id uuid := gen_random_uuid();
  test_rotation_id uuid := gen_random_uuid();
  result1 record;
  result2 record;
BEGIN
  -- Insert test credential record first
  INSERT INTO pos_credentials (id, location_id, provider, secret_ref, issued_at)
  VALUES (gen_random_uuid(), test_location_id, 'fudo', 'test-secret-ref', now());
  
  INSERT INTO pos_provider_credentials (location_id, provider, ciphertext, status)
  VALUES (test_location_id, 'fudo', 'test-encrypted-token', 'active');

  -- First call should succeed
  SELECT * INTO result1 FROM execute_atomic_rotation(
    test_location_id,
    'fudo'::app_pos_provider,
    test_rotation_id,
    'new-encrypted-token-1',
    now() + interval '1 hour'
  );

  -- Second call with same rotation_id should be idempotent
  SELECT * INTO result2 FROM execute_atomic_rotation(
    test_location_id,
    'fudo'::app_pos_provider,
    test_rotation_id,
    'new-encrypted-token-2',
    now() + interval '1 hour'
  );

  -- Validate results
  IF result1.operation_result != 'rotated' THEN
    RAISE EXCEPTION 'First rotation should succeed, got: %', result1.operation_result;
  END IF;

  IF result2.operation_result != 'idempotent' THEN
    RAISE EXCEPTION 'Second rotation should be idempotent, got: %', result2.operation_result;
  END IF;

  IF result2.is_idempotent != true THEN
    RAISE EXCEPTION 'Second rotation should have is_idempotent=true';
  END IF;

  RAISE NOTICE 'PASS: Idempotency test completed successfully';
  
  -- Cleanup
  DELETE FROM pos_provider_credentials WHERE location_id = test_location_id;
  DELETE FROM pos_credentials WHERE location_id = test_location_id;
END $$;
```

### 4. Circuit Breaker Health Check
```sql
-- Verify circuit breaker states are reasonable
SELECT 
  provider,
  location_id,
  state,
  failures,
  resume_at,
  CASE 
    WHEN state = 'open' AND resume_at > now() THEN 'HEALTHY_OPEN'
    WHEN state = 'closed' THEN 'HEALTHY_CLOSED' 
    WHEN state = 'half-open' THEN 'TESTING'
    ELSE 'ATTENTION_NEEDED'
  END as status
FROM rotation_cb 
WHERE provider = 'fudo'
ORDER BY location_id NULLS FIRST;
```

### 5. Metrics Collection Verification
```sql
-- Check rotation metrics are being recorded
SELECT 
  provider,
  metric_type,
  COUNT(*) as metric_count,
  MAX(recorded_at) as latest_metric,
  EXTRACT(epoch FROM (now() - MAX(recorded_at)))/3600 as hours_since_last
FROM pos_rotation_metrics 
WHERE provider = 'fudo'
  AND recorded_at > now() - interval '24 hours'
GROUP BY provider, metric_type
ORDER BY latest_metric DESC;

-- Expected: Recent metrics with reasonable counts
```

### 6. Job Heartbeat Monitoring
```sql
-- Verify job heartbeats are updating
SELECT 
  job_name,
  last_run_at,
  status,
  EXTRACT(epoch FROM (now() - last_run_at))/60 as minutes_since_last_run,
  CASE 
    WHEN EXTRACT(epoch FROM (now() - last_run_at))/60 < 60 THEN 'HEALTHY'
    WHEN EXTRACT(epoch FROM (now() - last_run_at))/60 < 1440 THEN 'WARNING' 
    ELSE 'CRITICAL'
  END as health_status,
  metadata->'successes' as last_successes,
  metadata->'failures' as last_failures
FROM job_heartbeats
WHERE job_name IN ('fudo_rotate_token', 'cron_healthcheck')
ORDER BY last_run_at DESC;
```

### 7. Security Audit Check
```sql
-- Verify no secrets are logged in metrics
SELECT 
  job_run_id,
  location_id,
  metric_type,
  meta
FROM pos_rotation_metrics 
WHERE provider = 'fudo'
  AND (
    meta::text LIKE '%token%' 
    OR meta::text LIKE '%secret%'
    OR meta::text LIKE '%password%'
  )
  AND meta::text NOT LIKE '%fingerprint%'
  AND recorded_at > now() - interval '1 hour'
LIMIT 5;

-- Expected: Empty result (no raw secrets in logs)
```

### 8. Edge Function Response Test
```sql
-- Test edge function connectivity (manual curl test)
-- Replace PROJECT_ID with actual project ID
/*
curl -X POST "https://PROJECT_ID.supabase.co/functions/v1/fudo-rotate-token" \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  --max-time 30

Expected: JSON response with rotation results
*/
```

## Health Thresholds

### ✅ Healthy System
- Rotation success rate: >95%
- Idempotency rate: <10% 
- Circuit breaker openings: <1 per day
- Mean rotation duration: <5 seconds
- Job heartbeat lag: <30 minutes

### ⚠️ Warning Signs
- Rotation success rate: 90-95%
- Idempotency rate: 10-25%
- Circuit breaker: Half-open for >1 hour
- Mean rotation duration: 5-15 seconds
- Job heartbeat lag: 30-60 minutes

### 🚨 Critical Issues
- Rotation success rate: <90%
- Consecutive failures: >3 for any location
- Global circuit breaker: Open for >2 hours
- Mean rotation duration: >15 seconds
- Job heartbeat lag: >60 minutes

## Emergency Procedures

### Stop All Rotations
```sql
-- Disable rotation cron job
SELECT cron.unschedule('fudo-pos-credentials-rotation');
```

### Force Reset Circuit Breakers
```sql
-- Reset all circuit breakers to closed state
UPDATE rotation_cb 
SET state = 'closed', 
    failures = 0, 
    resume_at = NULL, 
    updated_at = now()
WHERE provider = 'fudo';
```

### Manual Token Rotation Test
```sql
-- Test specific location rotation
SELECT * FROM execute_atomic_rotation(
  'SPECIFIC_LOCATION_UUID'::uuid,
  'fudo'::app_pos_provider,
  gen_random_uuid(),
  'test-encrypted-token',
  now() + interval '1 hour'
);
```

---

**Run these tests after each deployment to ensure system health.**
**Save results for comparison and trend analysis.**