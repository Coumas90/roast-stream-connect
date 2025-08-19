# POS Credentials Rotation - Runbook Operacional "Bulletproof"

Este documento describe el setup, operación y troubleshooting del sistema automatizado de rotación de credenciales POS con arquitectura production-ready.

## 🔧 Configuración del Cron Job

### Horario y Configuración
- **Función**: `pos-credentials-rotation`
- **Frecuencia**: Diario a las 03:15 AM (hora Buenos Aires) / 06:15 UTC
- **Expresión cron**: `15 6 * * *`
- **Método**: HTTP POST
- **Headers**: 
  - `Content-Type: application/json`
  - `X-Job-Token: <POS_SYNC_JOB_TOKEN>` (desde Vault)
- **Body**: `{"scheduled": true, "timestamp": "...", "trigger": "cron"}`

### Configuración Dinámica en Supabase
```sql
-- Configuración con base URL dinámica y token desde Vault
SELECT cron.schedule(
  'pos-credentials-rotation-daily',
  '15 6 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT value FROM app_settings WHERE key='edge_base_url') || '/functions/v1/pos-credentials-rotation',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'X-Job-Token', vault.decrypted_secret('POS_SYNC_JOB_TOKEN')
    ),
    body := jsonb_build_object('scheduled', true, 'timestamp', now(), 'trigger', 'cron')
  );
  $$
);
```

## 🚀 Mejoras "Bulletproof" Implementadas

### 1. Lease Lock System (Single Run Guarantee)
- **Tipo**: Database lease lock con TTL
- **TTL**: 15 minutos (900 segundos)
- **Tabla**: `job_locks`
- **Función**: `claim_job_lock()` / `release_job_lock()`
- **Garantía**: Solo una ejecución simultánea real

### 2. State Machine para Credenciales
- **Estados**: `active` → `pending` → `rotating` → `rotated`/`failed`
- **Campos**: `rotation_status`, `rotation_attempt_id`, `next_attempt_at`
- **Backoff automático**: 1h → 4h → 12h → 24h (exponencial)
- **Concurrencia**: `FOR UPDATE SKIP LOCKED`

### 3. Configuración Dinámica
- **Base URL**: `app_settings.edge_base_url`
- **Token**: `vault.decrypted_secret('POS_SYNC_JOB_TOKEN')`
- **Portabilidad**: No hardcode en SQL

### 4. Observabilidad Avanzada
- **Métricas**: `pos_rotation_metrics` por provider/location
- **Job Run ID**: UUID único por ejecución
- **Structured Logging**: Sin PII en respuestas
- **Error Codes**: Para clasificación de fallos

## 📋 Comandos Manuales

### Trigger Manual desde SQL
```sql
-- Solo para administradores de plataforma
SELECT public.trigger_pos_credentials_rotation();
```

### Trigger Manual desde Edge Function
```bash
curl -X POST \
  https://ipjidjijilhpblxrnaeg.supabase.co/functions/v1/pos-credentials-rotation \
  -H "Content-Type: application/json" \
  -H "X-Job-Token: YOUR_POS_SYNC_JOB_TOKEN" \
  -d '{"timestamp": "2025-01-19T12:00:00Z", "trigger": "manual"}'
```

### Verificar Jobs y Configuración
```sql
-- Ver todos los cron jobs configurados
SELECT * FROM cron.job;

-- Ver configuración dinámica
SELECT * FROM app_settings WHERE key = 'edge_base_url';

-- Ver lease locks activos
SELECT * FROM job_locks WHERE lease_until > now();
```

## 🔄 Lógica de Rotación Avanzada

### Criterios de Elegibilidad
1. **Status**: `rotation_status IN ('active', 'failed')`
2. **Expiración**: Credenciales que expiran en ≤ 7 días
3. **Backoff**: `next_attempt_at IS NULL OR next_attempt_at <= now()`
4. **Lease**: Lock de 15 minutos a nivel job
5. **Row Lock**: `FOR UPDATE SKIP LOCKED` por credencial

### Proceso de Rotación con State Machine
1. **Lease Lock**: `claim_job_lock('pos-credentials-rotation', 900)`
2. **Selección**: `pos_credentials_for_rotation(7)` con `SKIP LOCKED`
3. **Estado**: `pending` → `rotating` → `rotated`/`failed`
4. **Backoff**: Automático en fallos con error codes
5. **Métricas**: Por attempt, success, failure, backoff
6. **Release**: `release_job_lock()` en `finally`

### Backoff Strategy (Exponential)
- **Fallo 1**: 1 hora
- **Fallo 2**: 4 horas  
- **Fallo 3**: 12 horas
- **Fallo 4+**: 24 horas máximo

## 📊 Troubleshooting Avanzado

### Verificar Ejecución del Job
```sql
-- Historial de ejecuciones del cron
SELECT 
  runid, jobid, start_time, end_time, status, return_message
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'pos-credentials-rotation-daily')
ORDER BY start_time DESC LIMIT 10;

-- Ver lease locks recientes
SELECT name, lease_until, holder, updated_at 
FROM job_locks 
ORDER BY updated_at DESC;
```

### Métricas y Logs Estructurados
```sql
-- Métricas por job run
SELECT 
  job_run_id,
  metric_type,
  COUNT(*) as count,
  AVG(duration_ms) as avg_duration_ms
FROM pos_rotation_metrics 
WHERE recorded_at > now() - interval '7 days'
GROUP BY job_run_id, metric_type
ORDER BY job_run_id DESC;

-- Logs de rotación (sin PII)
SELECT ts, level, message, meta->>'job_run_id' as job_run_id
FROM pos_logs 
WHERE scope = 'credential_rotation'
ORDER BY ts DESC LIMIT 20;
```

### Credenciales por Estado
```sql
-- Estado actual de credenciales
SELECT 
  rotation_status,
  COUNT(*) as count,
  AVG(consecutive_rotation_failures) as avg_failures
FROM pos_credentials 
GROUP BY rotation_status;

-- Credenciales en backoff
SELECT 
  location_id,
  provider,
  rotation_status,
  consecutive_rotation_failures,
  next_attempt_at,
  rotation_error_code,
  EXTRACT(EPOCH FROM (next_attempt_at - now()))/3600 as hours_until_retry
FROM pos_credentials 
WHERE next_attempt_at > now()
ORDER BY next_attempt_at;
```

## 🚨 Alerting y Monitoreo

### Métricas Clave para Alertas
1. **job_locked > 0**: Job no puede ejecutar (lease lock ocupado)
2. **rotation_failure > 0**: Fallos en rotación
3. **backoff_scheduled > 0**: Credenciales en backoff
4. **credentials_near_expiry**: Sin rotar por 24h

### Health Check Query
```sql
-- Health check completo
SELECT 
  'job_lock_health' as metric,
  CASE WHEN COUNT(*) = 0 THEN 'ok' ELSE 'locked' END as status
FROM job_locks WHERE lease_until > now()
UNION ALL
SELECT 
  'credentials_health',
  CASE WHEN COUNT(*) = 0 THEN 'ok' ELSE 'critical' END
FROM pos_credentials 
WHERE expires_at <= now() + interval '1 day' 
  AND rotation_status != 'rotated';
```

## 🔧 Operaciones Avanzadas

### Pausar Rotaciones
```sql
-- Pausar por 1 hora (ej: durante mantenimiento)
UPDATE pos_credentials 
SET next_attempt_at = now() + interval '1 hour'
WHERE rotation_status = 'active';
```

### Reprocesar Fallidos
```sql
-- Reset de credenciales fallidas para reintento inmediato
UPDATE pos_credentials 
SET rotation_status = 'active',
    next_attempt_at = NULL,
    consecutive_rotation_failures = 0
WHERE rotation_status = 'failed';
```

### Cleanup de Métricas Antiguas
```sql
-- Limpiar métricas > 30 días
DELETE FROM pos_rotation_metrics 
WHERE recorded_at < now() - interval '30 days';
```

## 🔐 Seguridad Endurecida

### Autorización
- **Cron Job**: Token validation en tiempo constante
- **Manual Trigger**: Solo `is_tupa_admin()`
- **Rate Limiting**: Ligero en Edge Function
- **Content-Type**: Validación estricta

### Auditoría Completa
- **pos_logs**: Todas las operaciones (scope: `credential_rotation`)
- **pos_rotation_metrics**: Métricas granulares por job/provider/location  
- **No PII**: Responses sin location_id ni provider específicos
- **Structured**: Logs con job_run_id para correlación

### Configuración de Secrets
```sql
-- Rotar POS_SYNC_JOB_TOKEN
-- 1. Generar nuevo token: openssl rand -hex 32
-- 2. Actualizar en Supabase Secrets
-- 3. El cron job usará automáticamente el nuevo token
```

## 📈 Métricas de Producción

### Response Format (Sin PII)
```json
{
  "success": true,
  "summary": {
    "total": 5,
    "rotated": 3,
    "skipped": 0,
    "errors": 2
  }
  // Note: details removed for security
}
```

### KPIs Operacionales
- **Success Rate**: > 95%
- **Avg Duration**: < 30 segundos
- **Lock Conflicts**: < 1%
- **Backoff Rate**: < 10%

---

**🎯 Status**: Production-Ready con arquitectura bulletproof para single-run, state machine, observabilidad completa y seguridad endurecida.