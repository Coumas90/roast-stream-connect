# Operación diaria de pos-sync-daily

Este documento resume cómo operar, auditar y mantener la ejecución diaria del agregador POS.

## 1) Programación (schedule)
- Función: `pos-sync-daily`
- Cron recomendado:
  - 06:00 Buenos Aires (UTC-3) = `0 9 * * *`
  - 06:00 UTC = `0 6 * * *`
- Método: `POST`
- Headers:
  - `Content-Type: application/json`
  - `X-Job-Token: <POS_SYNC_JOB_TOKEN>` (usar el Secret, no pegar el valor)
- Body: `{}`

Para editar el horario o headers:
1. Supabase → Edge Functions → `pos-sync-daily` → Schedules
2. Editar el schedule activo y guardar.

## 2) Rotación de token (POS_SYNC_JOB_TOKEN)
- Ubicación: Supabase → Settings → Edge Functions → Secrets.
- Pasos:
  1. Generar un token nuevo (64 hex). Ej.: `openssl rand -hex 32`.
  2. Actualizar el Secret `POS_SYNC_JOB_TOKEN`.
  3. Actualizar el Schedule de `pos-sync-daily` para referenciar el Secret actual (no pegar el valor en claro).
  4. Ejecutar un smoke test (ver abajo).

## 3) Smoke test manual
- Desde el Tester/Run de `pos-sync-daily`:
  - Método: `POST`
  - Headers: `Content-Type: application/json`, `X-Job-Token: <POS_SYNC_JOB_TOKEN>`
  - Body: `{}`
- Respuesta esperada (200):
  ```json
  { "summary": { "total": N, "ok": X, "skipped": Y, "backoff": Z, "invalid": W, "errors": E } }
  ```

## 4) Lectura de logs (sin PII)
- `pos-sync-daily` logs: deben contener sólo hora de ejecución y el `summary` agregado. No se imprime `clientId/locationId/provider`.
- Detalle por corrida (runs):
  - Revisar `pos-sync` y `pos-sync-logger` para eventos con `runId` y (cuando aplique) `correlation_id`.

Enlaces útiles:
- Edge Functions: `…/functions`
- Logs `pos-sync-daily`: `…/functions/pos-sync-daily/logs`
- Secrets: `…/settings/functions`

## 5) Seguridad y privacidad
- Nunca exponer `POS_SYNC_JOB_TOKEN` en chats, tickets o commits.
- No loguear credenciales, ciphertext ni identificadores completos de clientes/sucursales.
- Usar siempre el Service Role para las operaciones internas del servidor.
