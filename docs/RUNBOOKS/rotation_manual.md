# POS Credentials Rotation Manual Operations

## Overview
This manual covers step-by-step procedures for manual POS credential rotation, emergency rollbacks, and troubleshooting. Designed for 10-minute operator execution during incidents.

## 🚨 Emergency Procedures (Critical)

### 1. Emergency Manual Rotation
**When to use**: Credential compromise, API failures, immediate rotation needed

```sql
-- STEP 1: Stop automated rotations temporarily
UPDATE pos_credentials 
SET next_attempt_at = now() + interval '2 hours'
WHERE rotation_status = 'active';

-- STEP 2: Manual rotation for specific location
SELECT public.execute_atomic_rotation(
  'location-id-here'::text,
  'new-encrypted-token'::text,
  gen_random_uuid()::text,
  'fudo'::text
);

-- STEP 3: Verify rotation success
SELECT 
  location_id,
  rotation_status,
  rotation_id,
  last_rotation_at
FROM pos_credentials 
WHERE location_id = 'location-id-here';
```

**Expected Response**: 
```
rotation_status: 'rotated'
last_rotation_at: [recent timestamp]
```

### 2. Emergency Rollback
**When to use**: New credentials failing, need to revert to previous tokens

```sql
-- STEP 1: Check if rollback data exists
SELECT 
  location_id,
  provider,
  rollback_ciphertext,
  rollback_expires_at
FROM pos_credentials 
WHERE location_id = 'location-id-here'
  AND rollback_ciphertext IS NOT NULL;

-- STEP 2: Execute rollback if available
UPDATE pos_credentials 
SET 
  ciphertext = rollback_ciphertext,
  expires_at = rollback_expires_at,
  rotation_status = 'rollback_executed',
  rollback_ciphertext = NULL,
  rollback_expires_at = NULL,
  updated_at = now()
WHERE location_id = 'location-id-here';

-- STEP 3: Reset circuit breaker
UPDATE rotation_cb 
SET state = 'closed', failures = 0, resume_at = NULL
WHERE provider = 'fudo' AND location_id = 'location-id-here';
```

**Expected Response**: 1 row updated for each operation

### 3. Force Circuit Breaker Reset
**When to use**: Breaker stuck open, blocking all rotations

```sql
-- STEP 1: Check current breaker states
SELECT provider, location_id, state, failures, resume_at
FROM rotation_cb 
WHERE state = 'open';

-- STEP 2: Force reset all open breakers
UPDATE rotation_cb 
SET 
  state = 'closed',
  failures = 0,
  resume_at = NULL,
  updated_at = now()
WHERE state = 'open';

-- STEP 3: Verify reset
SELECT COUNT(*) as open_breakers FROM rotation_cb WHERE state = 'open';
```

**Expected Response**: open_breakers: 0

## 🔧 Standard Manual Operations

### 1. Manual Rotation Trigger
**When to use**: Scheduled maintenance, proactive rotation

```sql
-- Option A: Trigger all eligible rotations
SELECT public.trigger_pos_credentials_rotation() as job_run_id;

-- Option B: Trigger specific provider
SELECT public.trigger_provider_rotation('fudo') as affected_locations;
```

**Expected Response**: UUID job_run_id or number of affected_locations

### 2. Rotation Status Check
**When to use**: Before and after rotation operations

```sql
-- All locations status
SELECT 
  provider,
  rotation_status,
  COUNT(*) as count,
  MIN(expires_at) as earliest_expiry,
  MAX(last_rotation_at) as latest_rotation
FROM pos_credentials 
GROUP BY provider, rotation_status
ORDER BY provider, rotation_status;

-- Specific location detail
SELECT 
  location_id,
  provider,
  rotation_status,
  expires_at,
  last_rotation_at,
  consecutive_rotation_failures,
  next_attempt_at,
  rotation_error_code
FROM pos_credentials 
WHERE location_id = 'location-id-here';
```

### 3. Failed Rotation Recovery
**When to use**: After resolving root cause of failures

```sql
-- STEP 1: Identify failed locations
SELECT 
  location_id,
  provider,
  consecutive_rotation_failures,
  rotation_error_code,
  next_attempt_at
FROM pos_credentials 
WHERE rotation_status = 'failed'
ORDER BY consecutive_rotation_failures DESC;

-- STEP 2: Reset failure counters for immediate retry
UPDATE pos_credentials 
SET 
  rotation_status = 'active',
  consecutive_rotation_failures = 0,
  next_attempt_at = NULL,
  rotation_error_code = NULL
WHERE rotation_status = 'failed'
  AND location_id = 'specific-location-id'; -- or remove for all

-- STEP 3: Monitor next rotation attempt
SELECT 
  location_id,
  rotation_status,
  next_attempt_at
FROM pos_credentials 
WHERE location_id = 'specific-location-id';
```

## 📊 Validation Commands

### 1. Pre-Operation Checks
Run before any manual operation:

```sql
-- Check system health
SELECT 
  'lease_locks' as component,
  COUNT(*) as active_locks
FROM job_locks WHERE lease_until > now()
UNION ALL
SELECT 
  'circuit_breakers',
  COUNT(*)
FROM rotation_cb WHERE state = 'open'
UNION ALL
SELECT 
  'failed_credentials',
  COUNT(*)
FROM pos_credentials WHERE rotation_status = 'failed';

-- Check recent rotation activity
SELECT 
  DATE_TRUNC('hour', recorded_at) as hour,
  metric_type,
  COUNT(*) as count,
  AVG(duration_ms) as avg_duration
FROM pos_rotation_metrics 
WHERE recorded_at > now() - interval '4 hours'
GROUP BY hour, metric_type
ORDER BY hour DESC;
```

### 2. Post-Operation Verification
Run after any manual operation:

```sql
-- Verify operation success
SELECT 
  rotation_status,
  COUNT(*) as count,
  MAX(last_rotation_at) as latest_success
FROM pos_credentials 
GROUP BY rotation_status;

-- Check for new errors
SELECT 
  location_id,
  rotation_error_code,
  meta->>'error_message' as error_detail
FROM pos_credentials pc
LEFT JOIN pos_rotation_metrics prm ON prm.location_id = pc.location_id
WHERE pc.rotation_status = 'failed'
  AND prm.recorded_at > now() - interval '10 minutes'
ORDER BY prm.recorded_at DESC;
```

## 🔍 Troubleshooting Commands

### 1. Rotation Stuck in "rotating" Status
```sql
-- Find stuck rotations (> 5 minutes)
SELECT 
  location_id,
  provider,
  rotation_status,
  rotation_id,
  updated_at,
  EXTRACT(EPOCH FROM (now() - updated_at))/60 as minutes_stuck
FROM pos_credentials 
WHERE rotation_status = 'rotating'
  AND updated_at < now() - interval '5 minutes';

-- Force reset stuck rotations
UPDATE pos_credentials 
SET 
  rotation_status = 'active',
  rotation_id = NULL,
  next_attempt_at = now() + interval '5 minutes'
WHERE rotation_status = 'rotating'
  AND updated_at < now() - interval '5 minutes';
```

### 2. High Idempotency Rate Investigation
```sql
-- Check for duplicate executions
SELECT 
  meta->>'rotation_id' as rotation_id,
  COUNT(*) as attempts,
  MIN(recorded_at) as first_attempt,
  MAX(recorded_at) as last_attempt
FROM pos_rotation_metrics 
WHERE recorded_at > now() - interval '1 hour'
  AND metric_type = 'rotation_attempt'
GROUP BY meta->>'rotation_id'
HAVING COUNT(*) > 1
ORDER BY attempts DESC;

-- Check cron job duplicates
SELECT 
  jobname,
  schedule,
  active,
  COUNT(*)
FROM cron.job 
WHERE jobname LIKE '%rotation%'
GROUP BY jobname, schedule, active;
```

### 3. Token Validation Failures
```sql
-- Recent validation failures
SELECT 
  location_id,
  provider,
  meta->>'error_code' as error_code,
  meta->>'error_message' as error_message,
  recorded_at
FROM pos_rotation_metrics 
WHERE meta->>'attempt_status' = 'failed'
  AND meta->>'error_code' IN ('401', '403', '422')
  AND recorded_at > now() - interval '2 hours'
ORDER BY recorded_at DESC;

-- Check credential encryption status
SELECT 
  location_id,
  provider,
  LENGTH(ciphertext) as token_length,
  expires_at,
  last_verified_at
FROM pos_credentials 
WHERE ciphertext IS NULL 
   OR LENGTH(ciphertext) < 20;
```

## 📋 Operator Checklists

### Pre-Incident Checklist
- [ ] Verify admin access to Supabase console
- [ ] Confirm POS provider API status
- [ ] Check recent rotation metrics (no unusual patterns)
- [ ] Verify no ongoing maintenance windows

### During Incident Checklist
- [ ] Document incident start time and symptoms
- [ ] Run pre-operation health checks
- [ ] Execute appropriate manual procedure
- [ ] Verify operation success with validation commands
- [ ] Document resolution steps taken

### Post-Incident Checklist
- [ ] Run post-operation verification
- [ ] Monitor for 30 minutes after resolution
- [ ] Document lessons learned
- [ ] Update runbook if new scenarios discovered
- [ ] Notify stakeholders of resolution

## 🚀 Quick Reference

### Most Common Commands
```sql
-- Emergency stop all rotations (2 hours)
UPDATE pos_credentials SET next_attempt_at = now() + interval '2 hours';

-- Manual trigger all eligible
SELECT public.trigger_pos_credentials_rotation();

-- Reset all circuit breakers
UPDATE rotation_cb SET state = 'closed', failures = 0, resume_at = NULL;

-- Check overall system health
SELECT rotation_status, COUNT(*) FROM pos_credentials GROUP BY rotation_status;
```

### Response Times
- **Emergency procedures**: Complete within 5 minutes
- **Standard operations**: Complete within 10 minutes
- **Validation checks**: Complete within 2 minutes
- **Troubleshooting**: Initial assessment within 15 minutes

---

**Target Audience**: Platform operators, SRE engineers, incident responders  
**Skill Level**: Intermediate SQL, basic POS system knowledge  
**Review Frequency**: Monthly or after significant incidents