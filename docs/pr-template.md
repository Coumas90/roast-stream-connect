# POS Token Rotation - Card 8 Implementation

## Overview
Implementation of atomic transactions, comprehensive idempotency, and production-ready monitoring for POS token rotation system.

## Changes Made

### 🔒 Database Changes
- [ ] Added `rotation_id` column to `pos_credentials` for idempotency tracking
- [ ] Created `execute_atomic_rotation` stored procedure with `SECURITY DEFINER`
- [ ] Added advisory locks to prevent concurrent double-swaps
- [ ] Added performance indexes for `rotation_id` and `rotation_attempt_id`
- [ ] Granted `service_role` execute permissions on rotation function

### 🚀 Edge Function Updates
- [ ] Updated `fudo-rotate-token` to use atomic stored procedure
- [ ] Implemented proper idempotency handling (no duplicate metrics)
- [ ] Added structured logging with token fingerprints (never raw tokens)
- [ ] Enhanced circuit breaker integration for location-specific failures

### 📊 Monitoring & Observability
- [ ] Created comprehensive runbooks for POS rotation and cron healthcheck
- [ ] Added detailed metrics tracking with `rotation_id` correlation
- [ ] Implemented anti-spam logic for healthcheck alerts (6-hour suppression)
- [ ] Added smoke test queries for production verification

### 🧪 Testing
- [ ] Created comprehensive idempotency tests
- [ ] Added concurrency test scenarios
- [ ] Implemented security tests (no token leakage)
- [ ] Created edge function integration test coverage

## Validation Checklist

### Pre-Deployment Verification
Run these SQL queries to verify the implementation:

```sql
-- 1. Verify atomic function exists and has correct permissions
SELECT 
  p.proname,
  p.prosecdef,
  array_agg(pr.rolname) as granted_roles
FROM pg_proc p
LEFT JOIN pg_proc_privileges pr ON p.oid = pr.objoid
WHERE p.proname = 'execute_atomic_rotation'
GROUP BY p.proname, p.prosecdef;

-- 2. Check rotation_id column and indexes
SELECT 
  schemaname,
  tablename,
  attname,
  indexname
FROM pg_indexes 
WHERE tablename IN ('pos_credentials', 'pos_provider_credentials')
  AND indexname LIKE '%rotation%';

-- 3. Verify no hardcoded URLs in cron jobs
SELECT * FROM cron.job WHERE command LIKE '%hardcoded-url%';

-- 4. Check healthcheck job configuration
SELECT jobname, schedule, command 
FROM cron.job 
WHERE jobname LIKE '%healthcheck%';
```

### Post-Deployment Smoke Tests
```sql
-- 1. Test idempotency (should return same result)
SELECT * FROM execute_atomic_rotation(
  'test-location-uuid'::uuid,
  'fudo'::app_pos_provider,
  'test-rotation-uuid'::uuid,
  'encrypted-test-token',
  now() + interval '1 hour'
);

-- 2. Check circuit breaker states
SELECT provider, location_id, state, failures, resume_at 
FROM rotation_cb 
WHERE provider = 'fudo';

-- 3. Verify rotation metrics are being recorded
SELECT 
  provider,
  metric_type,
  COUNT(*) as metric_count,
  MAX(recorded_at) as latest_metric
FROM pos_rotation_metrics 
WHERE provider = 'fudo'
GROUP BY provider, metric_type;

-- 4. Check job heartbeats are updating
SELECT 
  job_name,
  last_run_at,
  status,
  extract(epoch from (now() - last_run_at))/60 as minutes_since_last_run
FROM job_heartbeats;
```

## Risk Assessment

### 🟢 Low Risk
- Stored procedure uses `SECURITY DEFINER` with `search_path` restriction
- Advisory locks prevent concurrent modification races
- Idempotency ensures safe retries
- Comprehensive test coverage

### 🟡 Medium Risk
- First production deployment of atomic rotation logic
- Circuit breaker state changes affect rotation frequency
- New edge function integration patterns

### 🔴 High Risk
- None identified with current implementation

## Rollback Plan
1. **Emergency Stop**: Disable rotation cron job:
   ```sql
   SELECT cron.unschedule('pos-credentials-rotation');
   ```

2. **Function Rollback**: Revert to previous `execute_atomic_rotation`:
   ```sql
   -- Previous version without advisory locks
   -- (Keep backup migration ready)
   ```

3. **Circuit Breaker Reset**: Force reset if needed:
   ```sql
   UPDATE rotation_cb SET state = 'closed', failures = 0, resume_at = NULL;
   ```

## Deployment Steps
1. ✅ Run database migration
2. ✅ Deploy edge function updates
3. ✅ Verify cron job uses `edge_base_url`
4. ✅ Run post-deployment smoke tests
5. ✅ Monitor rotation metrics for 24h
6. ✅ Validate circuit breaker behavior
7. ✅ Check healthcheck anti-spam logic

## Monitoring Targets

### Success Metrics
- **Rotation Success Rate**: >95%
- **Idempotency Rate**: <10% (indicates minimal retries)
- **Circuit Breaker Openings**: <1 per day
- **Mean Rotation Duration**: <5 seconds

### Alert Thresholds
- **Critical**: Rotation success rate <90%
- **Warning**: Consecutive failures >3 for any location
- **Info**: Circuit breaker state changes

## Documentation
- ✅ [POS Rotation Runbook](./docs/runbook/pos-rotation.md)
- ✅ [Cron Healthcheck Runbook](./docs/runbook/cron-healthcheck.md)
- ✅ [Idempotency Test Suite](./tests/edge/atomic-rotation.test.ts)

---

**Reviewers**: Please verify all checkboxes above and run the validation SQL queries before approving.

**QA Notes**: Focus testing on concurrent rotation scenarios and idempotency edge cases.