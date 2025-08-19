# Cron Healthcheck System Runbook

## Overview

The cron healthcheck system monitors job heartbeats and sends alerts for stale jobs. It includes anti-spam protection to prevent alert flooding and supports both Slack and email notifications.

## Architecture

### Components
1. **job_heartbeats table**: Tracks job execution and alert state
2. **cron-healthcheck edge function**: Monitors and alerts on stale jobs  
3. **Anti-spam system**: Uses `last_alert_at` to suppress duplicate alerts
4. **Alert channels**: Slack webhook and email via Resend

### Heartbeat Flow
```
1. Job executes → Calls update_job_heartbeat()
2. Function upserts last_run_at, status, metadata
3. Cron-healthcheck runs every 6h
4. Checks for jobs not run in 24h+ 
5. Anti-spam check: skip if alerted in last 6h
6. Send alerts via Slack/email
7. Update last_alert_at timestamp
```

## Database Schema

### job_heartbeats Table
```sql
CREATE TABLE public.job_heartbeats (
  job_name text PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  status text DEFAULT 'healthy',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_alert_at timestamptz  -- Anti-spam column
);

-- Performance indexes
CREATE INDEX job_heartbeats_last_run_at_idx ON job_heartbeats(last_run_at);
CREATE INDEX job_heartbeats_last_alert_at_idx ON job_heartbeats(last_alert_at);
```

### Core Function
```sql
CREATE OR REPLACE FUNCTION public.update_job_heartbeat(
  p_job_name text, 
  p_status text DEFAULT 'healthy',
  p_metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.job_heartbeats(job_name, last_run_at, status, metadata, updated_at)
  VALUES (p_job_name, now(), p_status, p_metadata, now())
  ON CONFLICT (job_name) 
  DO UPDATE SET
    last_run_at = now(),
    status = EXCLUDED.status,
    metadata = EXCLUDED.metadata,
    updated_at = now();
END;
$$;
```

## Anti-Spam Logic

### Algorithm
```typescript
// In cron-healthcheck/index.ts
if (job.last_alert_at) {
  const timeSinceLastAlert = Date.now() - new Date(job.last_alert_at).getTime();
  const hoursSinceLastAlert = timeSinceLastAlert / (1000 * 60 * 60);
  
  if (hoursSinceLastAlert < 6) {
    result.suppressed_alerts++;
    console.log(`[ALERT] Suppressing alert for ${job.job_name} (last alert ${hoursSinceLastAlert.toFixed(1)}h ago)`);
    continue; // Skip this job
  }
}

// After sending alert
await supabase
  .from('job_heartbeats')
  .update({ last_alert_at: new Date().toISOString() })
  .eq('job_name', job.job_name);
```

### Configuration
- **Stale threshold**: 24 hours since last_run_at
- **Alert suppression**: 6 hours since last_alert_at
- **Check frequency**: Every 6 hours via cron

## Operations

### Monitor Stale Jobs
```sql
-- Find currently stale jobs (not run in 24h+)
SELECT 
  job_name,
  last_run_at,
  EXTRACT(hours FROM (now() - last_run_at)) as hours_overdue,
  status,
  last_alert_at,
  CASE 
    WHEN last_alert_at IS NULL THEN 'Never alerted'
    ELSE EXTRACT(hours FROM (now() - last_alert_at)) || ' hours ago'
  END as last_alert_info
FROM job_heartbeats
WHERE last_run_at < (now() - interval '24 hours')
ORDER BY last_run_at ASC;
```

### Check Alert History  
```sql
-- Recent alert activity
SELECT 
  job_name,
  last_run_at,
  last_alert_at,
  status,
  metadata
FROM job_heartbeats
WHERE last_alert_at > (now() - interval '48 hours')
ORDER BY last_alert_at DESC;
```

### View Healthy Jobs
```sql
-- Jobs running normally
SELECT 
  job_name,
  last_run_at,
  status,
  EXTRACT(hours FROM (now() - last_run_at)) as hours_since_last_run
FROM job_heartbeats
WHERE last_run_at > (now() - interval '24 hours')
ORDER BY last_run_at DESC;
```

### Anti-spam Analysis
```sql
-- Alert suppression statistics  
SELECT 
  date_trunc('day', last_alert_at) as alert_date,
  COUNT(*) as alerts_sent,
  COUNT(DISTINCT job_name) as unique_jobs_alerted
FROM job_heartbeats
WHERE last_alert_at > (now() - interval '7 days')
GROUP BY date_trunc('day', last_alert_at)
ORDER BY alert_date DESC;
```

## Configuration

### Required Secrets
Add these secrets in Supabase Edge Functions settings:

1. **SLACK_WEBHOOK_URL** (Required for Slack alerts)
   ```
   https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
   ```

2. **RESEND_API_KEY** (Optional for email alerts)
   ```
   re_YourResendAPIKey_123456789
   ```

3. **RESEND_FROM** (Required if using email)
   ```
   alerts@yourdomain.com
   ```

### Dynamic Configuration
The system uses `edge_base_url` from `app_settings`:

```sql
-- Set the edge function base URL
INSERT INTO app_settings (key, value) 
VALUES ('edge_base_url', 'https://your-project.supabase.co')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- The cron job automatically constructs URLs like:
-- {edge_base_url}/functions/v1/cron-healthcheck
```

### Cron Setup
```sql
-- Current cron configuration (runs every 6 hours)
SELECT 
  cron.schedule(
    'cron-healthcheck-job',
    '0 */6 * * *',
    $$
    select
      net.http_post(
        url := (
          SELECT RTRIM(value, '/') || '/functions/v1/cron-healthcheck'
          FROM public.app_settings 
          WHERE key = 'edge_base_url'
        ),
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{"trigger": "cron", "timestamp": "' || now() || '"}'::jsonb
      ) as request_id;
    $$
  );
```

## Troubleshooting

### No Alerts Being Sent

**Check 1: Verify secrets are configured**
```sql
-- This should return your secrets (values will be hidden)
SELECT name FROM vault.secrets WHERE name IN (
  'SLACK_WEBHOOK_URL', 
  'RESEND_API_KEY', 
  'RESEND_FROM'
);
```

**Check 2: Test edge function manually**
```sql
-- Manual trigger (should run immediately)
SELECT net.http_post(
  url := (
    SELECT RTRIM(value, '/') || '/functions/v1/cron-healthcheck'
    FROM public.app_settings 
    WHERE key = 'edge_base_url'
  ),
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{"trigger": "manual", "timestamp": "' || now() || '"}'::jsonb
);
```

**Check 3: Verify function logs**
Go to Supabase Dashboard → Edge Functions → cron-healthcheck → Logs

### Alerts Being Suppressed

**Check anti-spam timing:**
```sql
-- See which jobs are being suppressed and why
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
WHERE last_run_at < (now() - interval '24 hours');
```

**Force reset alert timestamp:**
```sql
-- Reset alert timestamp to force new alert
UPDATE job_heartbeats 
SET last_alert_at = NULL 
WHERE job_name = 'your-stale-job-name';
```

### Jobs Not Reporting Heartbeats

**Check job execution:**
```sql
-- See all jobs and their last heartbeat
SELECT 
  job_name,
  last_run_at,
  status,
  metadata,
  EXTRACT(hours FROM (now() - last_run_at)) as hours_since_heartbeat
FROM job_heartbeats
ORDER BY last_run_at DESC;
```

**Verify function grants:**
```sql
-- Ensure service_role can execute the heartbeat function
SELECT 
  grantee,
  privilege_type 
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' 
  AND routine_name = 'update_job_heartbeat';
```

### Cron Job Not Running

**Check cron job status:**
```sql
-- Verify cron job is active
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job 
WHERE jobname LIKE '%healthcheck%';
```

**Check cron execution history:**
```sql
-- See recent cron executions
SELECT 
  runid,
  jobid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobid IN (
  SELECT jobid FROM cron.job WHERE jobname LIKE '%healthcheck%'
)
ORDER BY start_time DESC
LIMIT 10;
```

## Emergency Procedures

### Disable All Alerts Temporarily
```sql
-- Set all jobs as recently alerted to suppress alerts
UPDATE job_heartbeats 
SET last_alert_at = now();
```

### Force Alert for Specific Job
```sql
-- Reset alert timestamp and trigger manual check
UPDATE job_heartbeats 
SET last_alert_at = NULL 
WHERE job_name = 'critical-job-name';

-- Then trigger manual healthcheck
SELECT net.http_post(
  url := (SELECT RTRIM(value, '/') || '/functions/v1/cron-healthcheck' FROM app_settings WHERE key = 'edge_base_url'),
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{"trigger": "emergency", "timestamp": "' || now() || '"}'::jsonb
);
```

### Bulk Job Recovery
```sql
-- Mark all jobs as recently run (emergency reset)
UPDATE job_heartbeats 
SET last_run_at = now(),
    status = 'recovered',
    last_alert_at = now()
WHERE last_run_at < (now() - interval '24 hours');
```

## Monitoring & Observability

### Key Metrics
1. **Stale Job Count**: Number of jobs not run in 24h+
2. **Alert Rate**: Alerts sent per day
3. **Suppression Rate**: Alerts suppressed due to anti-spam
4. **False Positive Rate**: Jobs that appear stale but recover quickly

### Recommended Alerts
```sql
-- Create monitoring view for external alerting
CREATE VIEW healthcheck_summary AS
SELECT 
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE last_run_at > now() - interval '24 hours') as healthy_jobs,
  COUNT(*) FILTER (WHERE last_run_at <= now() - interval '24 hours') as stale_jobs,
  COUNT(*) FILTER (WHERE last_alert_at > now() - interval '24 hours') as alerted_jobs,
  MAX(last_run_at) as most_recent_heartbeat,
  MIN(last_run_at) as oldest_heartbeat
FROM job_heartbeats;
```

### Performance Tuning

**Index optimization:**
```sql
-- Monitor index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'job_heartbeats';
```

**Query performance:**
```sql
-- Check slow queries on heartbeat table
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
WHERE query LIKE '%job_heartbeats%'
ORDER BY total_time DESC;
```

## Security Considerations

### Access Control
- Function uses `SECURITY DEFINER` with locked search_path
- RLS policies restrict access to admin users only
- Service role has minimal required permissions

### Secrets Management
- All webhook URLs and API keys stored in Supabase vault
- No secrets logged or exposed in function output
- Secrets rotation supported without code changes

### Data Retention
- Heartbeat data grows indefinitely by default
- Consider implementing retention policy:

```sql
-- Example: Delete heartbeats older than 90 days
DELETE FROM job_heartbeats 
WHERE created_at < (now() - interval '90 days')
  AND last_run_at < (now() - interval '30 days');
```