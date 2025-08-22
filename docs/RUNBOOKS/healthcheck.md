# Healthcheck System Operations Manual

**Owner**: @devops-team (Slack)  
**Severity**: P1-P2 (High/Medium)  
**Target Time**: 10 minutes  

## Overview
This manual provides operational procedures for the cron healthcheck system that monitors job heartbeats and sends alerts for stale jobs. All procedures designed for 10-minute execution.

## 🚨 Emergency Procedures

### 1. Disable All Alerts (Emergency Silence)
**When to use**: Major incident in progress, prevent alert flooding

```sql
-- STEP 1: Silence all alerts for 6 hours
UPDATE job_heartbeats 
SET last_alert_at = now() + interval '6 hours';

-- STEP 2: Verify silence applied
SELECT 
  job_name,
  last_alert_at,
  EXTRACT(hours FROM (last_alert_at - now())) as hours_silenced
FROM job_heartbeats 
WHERE last_alert_at > now();

-- STEP 3: Disable healthcheck cron temporarily
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'cron-healthcheck-job'),
  schedule := '* * * * *',  -- Every minute to prevent running
  command := 'SELECT 1'     -- No-op command
);
```

**Expected Response**: All jobs should show `hours_silenced > 0`

### 2. Force Alert for Critical Job
**When to use**: Critical job failure needs immediate attention

```sql
-- STEP 1: Reset alert timestamp for immediate alerting
UPDATE job_heartbeats 
SET last_alert_at = NULL,
    status = 'critical'
WHERE job_name = 'critical-job-name';

-- STEP 2: Trigger immediate healthcheck
SELECT net.http_post(
  url := (
    SELECT RTRIM(value, '/') || '/functions/v1/cron-healthcheck'
    FROM app_settings WHERE key = 'edge_base_url'
  ),
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := jsonb_build_object(
    'trigger', 'emergency',
    'timestamp', now(),
    'force_alert', 'critical-job-name'
  )
);

-- STEP 3: Verify alert sent
SELECT 
  job_name,
  last_alert_at,
  status
FROM job_heartbeats 
WHERE job_name = 'critical-job-name';
```

**Expected Response**: `last_alert_at` should be recent timestamp

### 3. Bulk Job Recovery (Mass Outage)
**When to use**: Multiple jobs appear stale due to platform issue

```sql
-- STEP 1: Identify affected jobs
SELECT 
  job_name,
  last_run_at,
  EXTRACT(hours FROM (now() - last_run_at)) as hours_overdue,
  status
FROM job_heartbeats 
WHERE last_run_at < (now() - interval '24 hours')
ORDER BY last_run_at ASC;

-- STEP 2: Mark all as recovered (emergency reset)
UPDATE job_heartbeats 
SET 
  last_run_at = now(),
  status = 'bulk_recovered',
  last_alert_at = now(),
  metadata = jsonb_build_object(
    'recovery_type', 'bulk_emergency',
    'recovery_timestamp', now(),
    'operator', current_user
  )
WHERE last_run_at < (now() - interval '24 hours');

-- STEP 3: Document recovery in logs
INSERT INTO pos_logs (scope, level, message, meta)
VALUES (
  'healthcheck',
  'warning',
  'Bulk job recovery executed',
  jsonb_build_object(
    'affected_jobs', (SELECT COUNT(*) FROM job_heartbeats WHERE status = 'bulk_recovered'),
    'operator', current_user,
    'reason', 'mass_outage_recovery'
  )
);
```

## 🔧 Standard Operations

### 1. Manual Healthcheck Trigger
**When to use**: Verify system working, troubleshoot alerts

```sql
-- Trigger immediate healthcheck run
SELECT net.http_post(
  url := (
    SELECT RTRIM(value, '/') || '/functions/v1/cron-healthcheck'
    FROM app_settings WHERE key = 'edge_base_url'
  ),
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := jsonb_build_object(
    'trigger', 'manual',
    'timestamp', now(),
    'operator', current_user
  )
) as request_id;
```

**Expected Response**: UUID request_id returned

### 2. Add New Job to Monitoring
**When to use**: New automated job needs healthcheck monitoring

```sql
-- Add new job with initial healthy status
INSERT INTO job_heartbeats (
  job_name,
  last_run_at,
  status,
  metadata
) VALUES (
  'new-job-name',
  now(),
  'healthy',
  jsonb_build_object(
    'added_by', current_user,
    'job_type', 'scheduled',
    'expected_frequency', '6h'
  )
) ON CONFLICT (job_name) DO UPDATE SET
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
```

### 3. Update Job Heartbeat Manually
**When to use**: Job completed but didn't update heartbeat

```sql
-- Update heartbeat for specific job
SELECT public.update_job_heartbeat(
  'job-name-here',
  'healthy',
  jsonb_build_object(
    'manual_update', true,
    'operator', current_user,
    'reason', 'missing_heartbeat'
  )
);

-- Verify update
SELECT 
  job_name,
  last_run_at,
  status,
  metadata
FROM job_heartbeats 
WHERE job_name = 'job-name-here';
```

## 📊 Monitoring Commands

### 1. System Health Overview
```sql
-- Overall healthcheck system status
SELECT 
  'total_jobs' as metric,
  COUNT(*) as value
FROM job_heartbeats
UNION ALL
SELECT 
  'healthy_jobs',
  COUNT(*)
FROM job_heartbeats 
WHERE last_run_at > now() - interval '24 hours'
UNION ALL
SELECT 
  'stale_jobs',
  COUNT(*)
FROM job_heartbeats 
WHERE last_run_at <= now() - interval '24 hours'
UNION ALL
SELECT 
  'recently_alerted',
  COUNT(*)
FROM job_heartbeats 
WHERE last_alert_at > now() - interval '24 hours';
```

### 2. Job Status Details
```sql
-- Detailed status of all monitored jobs
SELECT 
  job_name,
  last_run_at,
  EXTRACT(hours FROM (now() - last_run_at)) as hours_since_run,
  status,
  CASE 
    WHEN last_run_at > now() - interval '24 hours' THEN 'healthy'
    WHEN last_alert_at IS NULL THEN 'stale_never_alerted'
    WHEN last_alert_at < now() - interval '6 hours' THEN 'stale_alert_due'
    ELSE 'stale_recently_alerted'
  END as health_status,
  last_alert_at,
  metadata
FROM job_heartbeats
ORDER BY last_run_at ASC;
```

### 3. Alert Activity Analysis
```sql
-- Alert patterns and frequency
SELECT 
  DATE_TRUNC('day', last_alert_at) as alert_date,
  COUNT(*) as alerts_sent,
  COUNT(DISTINCT job_name) as unique_jobs_alerted,
  array_agg(DISTINCT job_name) as alerted_jobs
FROM job_heartbeats 
WHERE last_alert_at > now() - interval '7 days'
GROUP BY DATE_TRUNC('day', last_alert_at)
ORDER BY alert_date DESC;

-- Anti-spam effectiveness
SELECT 
  job_name,
  COUNT(*) as total_stale_periods,
  COUNT(last_alert_at) as alerts_sent,
  ROUND(
    (COUNT(last_alert_at) * 100.0) / COUNT(*), 2
  ) as alert_rate_pct
FROM (
  SELECT 
    job_name,
    last_alert_at,
    generate_series(
      DATE_TRUNC('day', NOW() - interval '7 days'),
      DATE_TRUNC('day', NOW()),
      interval '1 day'
    ) as day
  FROM job_heartbeats
  WHERE last_run_at < now() - interval '24 hours'
) t
GROUP BY job_name
ORDER BY alert_rate_pct DESC;
```

## 🔍 Troubleshooting Procedures

### 1. No Alerts Being Sent
```sql
-- STEP 1: Check secrets configuration
SELECT name, created_at 
FROM vault.secrets 
WHERE name IN ('SLACK_WEBHOOK_URL', 'RESEND_API_KEY', 'RESEND_FROM');

-- STEP 2: Check edge function configuration
SELECT key, value 
FROM app_settings 
WHERE key = 'edge_base_url';

-- STEP 3: Test manual trigger and check logs
SELECT net.http_post(
  url := (SELECT RTRIM(value, '/') || '/functions/v1/cron-healthcheck' FROM app_settings WHERE key = 'edge_base_url'),
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{"trigger": "test", "timestamp": "' || now() || '"}'::jsonb
);
```

**Check edge function logs**: Supabase Dashboard → Edge Functions → cron-healthcheck → Logs

### 2. Alerts Being Suppressed
```sql
-- Analyze suppression patterns
SELECT 
  job_name,
  last_run_at,
  last_alert_at,
  EXTRACT(hours FROM (now() - last_run_at)) as hours_overdue,
  EXTRACT(hours FROM (now() - COALESCE(last_alert_at, '-infinity'))) as hours_since_alert,
  CASE 
    WHEN last_alert_at IS NULL THEN 'Never alerted (should alert)'
    WHEN (now() - last_alert_at) < interval '6 hours' THEN 'Suppressed (< 6h since last alert)'
    ELSE 'Should alert (>= 6h since last alert)'
  END as alert_status
FROM job_heartbeats
WHERE last_run_at < (now() - interval '24 hours')
ORDER BY hours_overdue DESC;

-- Force reset specific job for immediate alert
UPDATE job_heartbeats 
SET last_alert_at = NULL 
WHERE job_name = 'job-to-force-alert';
```

### 3. Cron Job Not Executing
```sql
-- Check cron job status
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job 
WHERE jobname LIKE '%healthcheck%';

-- Check recent execution history
SELECT 
  runid,
  jobid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time,
  EXTRACT(EPOCH FROM (end_time - start_time)) as duration_seconds
FROM cron.job_run_details 
WHERE jobid IN (
  SELECT jobid FROM cron.job WHERE jobname LIKE '%healthcheck%'
)
ORDER BY start_time DESC
LIMIT 10;
```

### 4. Jobs Not Reporting Heartbeats
```sql
-- Find jobs that should be reporting but aren't
SELECT 
  j.jobname as expected_job,
  j.schedule,
  j.active,
  hb.job_name as heartbeat_job,
  hb.last_run_at
FROM cron.job j
LEFT JOIN job_heartbeats hb ON j.jobname = hb.job_name
WHERE j.active = true
  AND (hb.job_name IS NULL OR hb.last_run_at < now() - interval '25 hours')
ORDER BY j.jobname;

-- Check function permissions
SELECT 
  routine_schema,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' 
  AND routine_name = 'update_job_heartbeat'
  AND grantee = 'service_role';
```

## 📋 Configuration Management

### 1. Update Alert Thresholds
```sql
-- Modify stale job threshold (default: 24 hours)
-- This requires updating the edge function code
-- Current threshold check: last_run_at < now() - interval '24 hours'

-- Modify alert suppression window (default: 6 hours)  
-- Current suppression: hours_since_last_alert < 6

-- These are hardcoded in cron-healthcheck/index.ts
-- Update requires edge function deployment
```

### 2. Add/Remove Alert Channels
```sql
-- Add new Slack webhook
INSERT INTO vault.secrets (name, secret) 
VALUES ('SLACK_WEBHOOK_URL_TEAM2', 'https://hooks.slack.com/services/...');

-- Add email configuration
INSERT INTO vault.secrets (name, secret) 
VALUES ('RESEND_API_KEY', 're_YourNewKey');

INSERT INTO vault.secrets (name, secret) 
VALUES ('RESEND_FROM', 'alerts@newdomain.com');

-- Remove old secrets
DELETE FROM vault.secrets WHERE name = 'OLD_WEBHOOK_URL';
```

### 3. Modify Cron Schedule
```sql
-- Change healthcheck frequency (default: every 6 hours)
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'cron-healthcheck-job'),
  schedule := '0 */4 * * *'  -- Every 4 hours instead of 6
);

-- Verify change
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'cron-healthcheck-job';
```

## 📈 Performance Optimization

### 1. Index Analysis
```sql
-- Check index usage for optimization
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'job_heartbeats'
ORDER BY idx_scan DESC;

-- Query performance analysis
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
WHERE query LIKE '%job_heartbeats%'
ORDER BY total_time DESC
LIMIT 5;
```

### 2. Data Retention Management
```sql
-- Check data growth
SELECT 
  COUNT(*) as total_heartbeats,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record,
  EXTRACT(days FROM (MAX(created_at) - MIN(created_at))) as days_of_data
FROM job_heartbeats;

-- Cleanup old heartbeat records (optional)
DELETE FROM job_heartbeats 
WHERE created_at < (now() - interval '90 days')
  AND last_run_at < (now() - interval '30 days')
  AND job_name NOT IN ('critical-job-1', 'critical-job-2');
```

## 🚀 Quick Reference

### Emergency Commands
```sql
-- Silence all alerts for 6 hours
UPDATE job_heartbeats SET last_alert_at = now() + interval '6 hours';

-- Force alert for critical job
UPDATE job_heartbeats SET last_alert_at = NULL WHERE job_name = 'critical-job';

-- Bulk recovery
UPDATE job_heartbeats SET last_run_at = now(), status = 'recovered' WHERE last_run_at < now() - interval '24 hours';
```

### Health Check Commands
```sql
-- Overall system status
SELECT 'stale', COUNT(*) FROM job_heartbeats WHERE last_run_at < now() - interval '24 hours';

-- Manual trigger
SELECT net.http_post(url := (SELECT value || '/functions/v1/cron-healthcheck' FROM app_settings WHERE key = 'edge_base_url'), headers := '{"Content-Type": "application/json"}'::jsonb, body := '{"trigger": "manual"}'::jsonb);
```

### Response Times
- **Emergency silence**: 1 minute
- **Force alert**: 2 minutes  
- **Bulk recovery**: 5 minutes
- **Configuration changes**: 10 minutes

---

**Target Audience**: Platform operators, DevOps engineers, incident responders  
**Skill Level**: Basic SQL, understanding of cron jobs  
**Review Frequency**: Quarterly or after healthcheck system changes