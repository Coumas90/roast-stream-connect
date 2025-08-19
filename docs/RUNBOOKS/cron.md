# POS Credentials Rotation - Cron Jobs & Manual Triggers

Este documento describe la configuración y operación del sistema de rotación automática de credenciales POS.

## Configuración del Cron Job

### Horario Programado
- **Frecuencia**: Diario
- **Hora**: 03:15 America/Argentina/Buenos_Aires (06:15 UTC)
- **Cron Expression**: `15 6 * * *`

### Job Configurado en Supabase
```sql
SELECT cron.schedule(
  'pos-credentials-rotation-daily',
  '15 6 * * *',
  $$
  SELECT net.http_post(
    url:='https://ipjidjijilhpblxrnaeg.supabase.co/functions/v1/pos-credentials-rotation',
    headers:='{"Content-Type": "application/json", "X-Job-Token": "' || current_setting('app.pos_sync_job_token') || '"}'::jsonb,
    body:='{"timestamp": "' || now() || '"}'::jsonb
  ) as request_id;
  $$
);
```

## Comandos Manuales

### Trigger Manual desde SQL
```sql
-- Solo para administradores de plataforma
SELECT public.trigger_pos_credentials_rotation();
```

### Trigger Manual desde Edge Function
```bash
# Desde terminal con curl
curl -X POST \
  https://ipjidjijilhpblxrnaeg.supabase.co/functions/v1/pos-credentials-rotation \
  -H "Content-Type: application/json" \
  -H "X-Job-Token: YOUR_POS_SYNC_JOB_TOKEN" \
  -d '{"timestamp": "2025-01-19T12:00:00Z", "trigger": "manual"}'
```

### Verificar Jobs Activos
```sql
-- Ver todos los cron jobs configurados
SELECT * FROM cron.job;

-- Ver el job específico de rotación
SELECT * FROM cron.job WHERE jobname = 'pos-credentials-rotation-daily';
```

## Lógica de Rotación

### Criterios de Elegibilidad
1. **Status**: Solo credenciales con status = 'active'
2. **Expiración**: Credenciales que expiran en ≤ 7 días
3. **Lock**: Sin rotación en las últimas 2 horas

### Proceso de Rotación
1. **Identificación**: Consulta `pos_credentials_expiring_soon(7)`
2. **Lock Check**: Verifica `last_rotation_attempt_at` (timeout: 2h)
3. **Marcado**: Ejecuta `mark_credential_for_rotation()`
4. **Rotación**: Genera nuevas credenciales con el proveedor
5. **Logging**: Registra resultado en `pos_logs`

### Lock Mechanism
- **Tipo**: Natural lock usando `last_rotation_attempt_at`
- **Timeout**: 2 horas (7200 segundos)
- **Propósito**: Evitar rotaciones simultáneas y solapamiento

## Troubleshooting

### Verificar Ejecución del Cron
```sql
-- Ver historial de ejecuciones
SELECT 
  runid, 
  jobid, 
  start_time, 
  end_time, 
  status, 
  return_message
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'pos-credentials-rotation-daily')
ORDER BY start_time DESC
LIMIT 10;
```

### Verificar Logs de Rotación
```sql
-- Ver logs de rotación de credenciales
SELECT 
  ts,
  level,
  message,
  location_id,
  provider,
  meta
FROM pos_logs 
WHERE scope = 'credential_rotation'
ORDER BY ts DESC
LIMIT 20;
```

### Credenciales Pendientes de Rotación
```sql
-- Ver credenciales próximas a expirar
SELECT * FROM pos_credentials_expiring_soon(7);

-- Ver credenciales con lock activo
SELECT 
  location_id,
  provider,
  status,
  last_rotation_attempt_at,
  expires_at,
  EXTRACT(EPOCH FROM (now() - last_rotation_attempt_at))/3600 as hours_since_last_attempt
FROM pos_credentials 
WHERE last_rotation_attempt_at > now() - interval '2 hours'
ORDER BY last_rotation_attempt_at DESC;
```

### Problemas Comunes

#### 1. Job no ejecuta
- Verificar que `pg_cron` y `pg_net` estén habilitados
- Verificar token `POS_SYNC_JOB_TOKEN` en secrets
- Revisar logs de Supabase Edge Functions

#### 2. Credenciales no rotan
- Verificar que el proveedor esté disponible
- Verificar permisos de ubicación
- Revisar locks activos (timeout 2h)

#### 3. Fallos de autenticación
- Verificar token `X-Job-Token` en headers
- Verificar configuración de secrets en Supabase

## Métricas y Alertas

### Métricas Esperadas
- **Total credenciales evaluadas**: Número de credenciales próximas a expirar
- **Rotaciones exitosas**: Credenciales rotadas correctamente
- **Skipped**: Credenciales omitidas (lock o status inactivo)
- **Errores**: Fallos en rotación

### Response Format
```json
{
  "success": true,
  "summary": {
    "total": 5,
    "rotated": 3,
    "skipped": 1,
    "errors": 1
  },
  "details": [
    {
      "location_id": "uuid",
      "provider": "fudo",
      "status": "rotated"
    }
  ]
}
```

## Rotación Manual de Tokens

### Regenerar Job Token
1. Generar nuevo token en Supabase Secrets
2. Actualizar variable `POS_SYNC_JOB_TOKEN`
3. El cron job usará automáticamente el nuevo token

### Desactivar Temporalmente
```sql
-- Desactivar el job
SELECT cron.unschedule('pos-credentials-rotation-daily');

-- Reactivar el job
SELECT cron.schedule(
  'pos-credentials-rotation-daily',
  '15 6 * * *',
  $$ /* mismo SQL del job */ $$
);
```

## Seguridad

### Autorización
- **Cron Job**: Autenticado por `X-Job-Token`
- **Manual Trigger**: Solo `is_tupa_admin()`
- **Logs**: Sin información sensible (PII)

### Auditoría
- Todas las operaciones se registran en `pos_logs`
- Scope: `credential_rotation`
- Incluye metadata de usuario y timestamp
- Logs de acceso a credenciales en `security_audit`

---

**Nota**: Este sistema está diseñado para ser robusto y seguro. El lock mechanism previene ejecuciones simultáneas y el logging completo facilita la auditoría y troubleshooting.