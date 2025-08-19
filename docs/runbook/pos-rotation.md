# POS Token Rotation Runbook

## Overview

This runbook covers the end-to-end token rotation system for POS integrations, with a focus on the Fudo provider. The system ensures atomic, idempotent rotations with comprehensive observability.

## Architecture

### Rotation Flow
```
1. Cron Trigger (every 6h) → Edge Function
2. Edge Function → Get Expiring Credentials
3. For each location:
   - Generate rotation_id (UUID v4)
   - Ping /me endpoint (validate current token)
   - Fetch new token from Fudo API
   - Validate new token (/me)
   - Execute atomic rotation (stored procedure)
   - Record metrics with rotation_id
4. Update circuit breaker states
5. Record job heartbeat
```

### Atomic Transaction Components
The `execute_atomic_rotation` stored procedure ensures:
- **Idempotency Check**: Same rotation_id → immediate return
- **Atomic Swap**: Update credentials with IS DISTINCT FROM check
- **Metadata Persistence**: Update pos_credentials with rotation_id
- **Rollback Safety**: Any failure rolls back entire transaction

## Key Tables

### pos_credentials
- `rotation_id uuid`: Audit trail for rotation attempts
- `rotation_status text`: Current rotation state
- `rotation_attempt_id uuid`: Links to pos_provider_credentials
- `consecutive_rotation_failures int`: Exponential backoff counter
- `next_attempt_at timestamptz`: Backoff schedule

### pos_provider_credentials  
- `rotation_attempt_id uuid`: Idempotency key for swaps
- `ciphertext text`: Encrypted token storage
- `status text`: active/pending/failed

### pos_rotation_metrics
- `rotation_id uuid`: In meta field for correlation
- `metric_type text`: rotation_attempt, job_summary
- `meta jsonb`: Contains idempotent_hit, attempt_status, etc.

## Circuit Breaker

### States
- **Closed**: Normal operation (≤10 failures in 15min)
- **Open**: Blocked for 60min (≥10 failures in 15min window)  
- **Half-Open**: Testing after 60min lockout

### Hybrid Mode
- Global breaker: provider-level (affects all locations)
- Location breaker: provider + location_id specific

### Error Classification
**Non-breaking errors** (don't open circuit):
- 401 Unauthorized
- 403 Forbidden  
- 422 Unprocessable Entity

**Breaking errors** (count toward threshold):
- 429 Too Many Requests
- 5xx Server Errors
- Network timeouts
- Connection failures

## Observability

### Metrics Fields
```sql
-- Key metrics tracked
SELECT 
  rotation_id,
  provider,
  location_id,
  metric_type,
  value,
  duration_ms,
  meta->>'idempotent_hit' as is_idempotent,
  meta->>'attempt_status' as status,
  meta->>'operation_result' as result
FROM pos_rotation_metrics
WHERE recorded_at > now() - interval '24 hours';
```

### Log Correlation
All logs include `[rotation_id]` prefix for correlation:
```
[abc-123] Starting atomic token rotation for location xyz
[abc-123] New token validated for user: Restaurant ABC
[abc-123] Atomic rotation completed: 1 rows updated
```

### Security
- **No raw tokens in logs**: Only fingerprints (HMAC-SHA256 truncated)
- **Encrypted storage**: All tokens encrypted at rest
- **Audit trail**: rotation_id links all operations

## Operations

### Manual Rotation
```sql
-- Trigger manual rotation for all expiring credentials
SELECT public.trigger_pos_credentials_rotation();

-- Check specific location rotation status
SELECT 
  location_id,
  provider,
  rotation_status,
  rotation_id,
  last_rotation_at,
  consecutive_rotation_failures,
  next_attempt_at
FROM pos_credentials 
WHERE location_id = 'your-location-id';
```

### Inspect Recent Rotations
```sql
-- Last 24h rotation attempts with outcomes
SELECT 
  prm.recorded_at,
  prm.location_id,
  prm.provider,
  prm.duration_ms,
  prm.meta->>'rotation_id' as rotation_id,
  prm.meta->>'attempt_status' as status,
  prm.meta->>'idempotent_hit' as was_idempotent,
  prm.meta->>'operation_result' as result
FROM pos_rotation_metrics prm
WHERE prm.metric_type = 'rotation_attempt'
  AND prm.recorded_at > now() - interval '24 hours'
ORDER BY prm.recorded_at DESC;
```

### Check Circuit Breaker States
```sql
-- Current circuit breaker states
SELECT 
  provider,
  location_id,
  state,
  failures,
  window_start,
  resume_at,
  updated_at
FROM rotation_cb
ORDER BY updated_at DESC;
```

### Idempotency Analysis
```sql
-- Idempotency hit rate by provider
SELECT 
  provider,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE meta->>'idempotent_hit' = 'true') as idempotent_hits,
  ROUND(
    (COUNT(*) FILTER (WHERE meta->>'idempotent_hit' = 'true') * 100.0) / COUNT(*), 
    2
  ) as idempotency_rate_pct
FROM pos_rotation_metrics
WHERE metric_type = 'rotation_attempt'
  AND recorded_at > now() - interval '7 days'
GROUP BY provider;
```

## Troubleshooting

### Common Issues

#### High Idempotency Rate
**Symptoms**: >50% idempotent_hit rate
**Diagnosis**:
```sql
-- Check for duplicate cron jobs
SELECT * FROM cron.job WHERE jobname LIKE '%rotation%';

-- Check for concurrent executions
SELECT 
  meta->>'rotation_id' as rotation_id,
  COUNT(*) as attempts
FROM pos_rotation_metrics 
WHERE recorded_at > now() - interval '1 hour'
GROUP BY meta->>'rotation_id'
HAVING COUNT(*) > 1;
```
**Resolution**: Remove duplicate cron jobs, check edge function timeout settings

#### Circuit Breaker Stuck Open
**Symptoms**: All rotations failing with "circuit open"
**Diagnosis**:
```sql
-- Check breaker states
SELECT * FROM rotation_cb WHERE state = 'open';

-- Recent failures leading to open state
SELECT * FROM pos_logs 
WHERE scope = 'circuit_breaker' 
  AND message LIKE '%opened%'
  AND ts > now() - interval '2 hours';
```
**Resolution**: 
- Wait for auto-recovery (60min)
- Or manually reset: `UPDATE rotation_cb SET state='closed', failures=0 WHERE provider='fudo';`

#### Rotation Timeouts
**Symptoms**: Edge function timeouts, incomplete rotations
**Diagnosis**:
```sql
-- Check rotation durations
SELECT 
  AVG(duration_ms) as avg_duration,
  MAX(duration_ms) as max_duration,
  COUNT(*) as attempts
FROM pos_rotation_metrics
WHERE metric_type = 'rotation_attempt'
  AND recorded_at > now() - interval '24 hours';
```
**Resolution**: 
- Check Fudo API latency
- Verify network connectivity
- Review edge function timeout limits

#### Token Validation Failures
**Symptoms**: 401/403 errors during validation
**Diagnosis**:
```sql
-- Check recent failed attempts
SELECT 
  location_id,
  meta->>'error_message' as error,
  recorded_at
FROM pos_rotation_metrics
WHERE meta->>'attempt_status' = 'failed'
  AND recorded_at > now() - interval '6 hours'
ORDER BY recorded_at DESC;
```
**Resolution**:
- Verify Fudo API credentials
- Check API endpoint URLs
- Validate environment configuration

### Emergency Procedures

#### Force Reset All Circuit Breakers
```sql
UPDATE rotation_cb 
SET state = 'closed', 
    failures = 0, 
    resume_at = NULL,
    updated_at = now();
```

#### Disable Rotation for Location
```sql
UPDATE pos_credentials 
SET rotation_status = 'disabled',
    next_attempt_at = NULL
WHERE location_id = 'problem-location-id';
```

#### Manual Token Update (Emergency)
```sql
-- Only use in emergencies, bypasses normal rotation flow
UPDATE pos_provider_credentials 
SET ciphertext = 'encrypted-emergency-token',
    status = 'active',
    last_verified_at = now(),
    updated_at = now()
WHERE location_id = 'emergency-location-id' 
  AND provider = 'fudo';
```

## Monitoring & Alerts

### Key Metrics to Monitor
1. **Rotation Success Rate**: >95% success rate
2. **Circuit Breaker Openings**: Alert on any provider opening
3. **Idempotency Rate**: Alert if >30% (indicates issues)
4. **Rotation Duration**: Alert if >30s average
5. **Failed Locations**: Alert if same location fails >3 times

### Recommended Alerts
```sql
-- Create monitoring views for alerting
CREATE VIEW rotation_health_summary AS
SELECT 
  provider,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE meta->>'attempt_status' = 'rotated') as successful,
  COUNT(*) FILTER (WHERE meta->>'attempt_status' = 'failed') as failed,
  AVG(duration_ms) as avg_duration_ms,
  COUNT(*) FILTER (WHERE meta->>'idempotent_hit' = 'true') as idempotent_hits
FROM pos_rotation_metrics
WHERE metric_type = 'rotation_attempt'
  AND recorded_at > now() - interval '24 hours'
GROUP BY provider;
```

## Configuration

### Environment Variables
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for DB access
- `POS_CRED_KMS_KEY`: KMS key for credential encryption

### Cron Schedule
```sql
-- Current cron job (runs every 6 hours)
SELECT * FROM cron.job WHERE jobname = 'pos-credentials-rotation';

-- Modify schedule if needed
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'pos-credentials-rotation'),
  schedule := '0 */4 * * *'  -- Every 4 hours instead of 6
);
```

## Performance Tuning

### Index Optimization
```sql
-- Ensure key indexes exist
CREATE INDEX CONCURRENTLY pos_credentials_rotation_lookup 
  ON pos_credentials(provider, location_id, rotation_status, expires_at);

CREATE INDEX CONCURRENTLY pos_rotation_metrics_analysis
  ON pos_rotation_metrics(provider, recorded_at, metric_type) 
  INCLUDE (location_id, duration_ms, meta);
```

### Batch Size Tuning
Default batch size: 50 locations per execution
Adjust in edge function if needed based on:
- API rate limits
- Edge function timeout
- Database connection limits

## Security Considerations

### Token Security
- All tokens encrypted using KMS
- Rotation IDs are UUIDs (no sequence enumeration)
- Fingerprints use HMAC-SHA256
- No raw tokens in logs or metrics

### Access Control
- Edge function uses service role
- Stored procedures use SECURITY DEFINER
- RLS policies restrict data access
- Audit trails for all operations

### Compliance
- Tokens rotated every 6 hours (configurable)
- Full audit trail maintained
- Encryption at rest and in transit
- Failed rotation alerting