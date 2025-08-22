# Operational Runbooks - Index

## Quick Access Guide

### 🚨 Emergency Procedures
- **[Rotation Manual](./rotation_manual.md#emergency-procedures-critical)** - Token rotation emergencies, rollbacks
- **[Healthcheck Manual](./healthcheck.md#emergency-procedures)** - Alert system emergencies, bulk recovery

### 📚 Complete Documentation
- **[Architecture Overview](../ARCHITECTURE.md)** - System design, components, data flow
- **[Security Guidelines](../SECURITY.md)** - CORS, secrets, data scrubbing, compliance
- **[POS Rotation Runbook](../runbook/pos-rotation.md)** - Detailed rotation system operations
- **[Cron Healthcheck Runbook](../runbook/cron-healthcheck.md)** - Job monitoring system

## Quick Reference Commands

### Emergency Actions (5 minutes)
```sql
-- Stop all rotations
UPDATE pos_credentials SET next_attempt_at = now() + interval '2 hours';

-- Silence all alerts  
UPDATE job_heartbeats SET last_alert_at = now() + interval '6 hours';

-- Reset circuit breakers
UPDATE rotation_cb SET state = 'closed', failures = 0, resume_at = NULL;
```

### Health Checks (2 minutes)
```sql
-- System status
SELECT rotation_status, COUNT(*) FROM pos_credentials GROUP BY rotation_status;
SELECT 'stale_jobs', COUNT(*) FROM job_heartbeats WHERE last_run_at < now() - interval '24 hours';
```

## Documentation Standards
- **10-minute execution target** for all procedures
- **Expected responses** included for validation
- **Step-by-step commands** with safety checks
- **Troubleshooting guides** for common issues

---
**Card #15 Complete** ✅ Full operational documentation delivered