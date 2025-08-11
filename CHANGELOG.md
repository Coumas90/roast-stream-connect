# Changelog

Todas las modificaciones relevantes se documentan aquí. Este archivo utiliza secciones por tipo de cambio.

## pos-v1.0 — 2025-08-11

### Added
- Edge Function `pos-sync-daily`: orquestación diaria de sincronización POS con control de concurrencia y reporte de resumen.
- Integraciones POS: Fudo y Bistrosoft (client, mapper, service), registro de proveedores y SDK base para POS (contratos en `sdk/pos/index.ts`).
- `pos-sync` y `pos-sync-logger`: ejecución por ubicación y bitácora de eventos con `runId`/`correlation_id`.
- Páginas de administración: Integrations y PosStatus para visualizar estado y conectividad.
- Cobertura de pruebas para integraciones, sync y edge functions.

### Changed
- Documentación actualizada en `docs/pos-sync/operacion.md`: rotación segura de `POS_SYNC_JOB_TOKEN`, smoke test y lineamientos de logging sin PII.

### Fixed
- Ajustes menores en manejo de errores y tipos en integraciones POS.

### Docs
- Guía de operación diaria (`pos-sync-daily`) y checklist de seguridad.

### CI
- Workflow `ci` de GitHub Actions: typecheck, lint, test y build en PR y `main`.
