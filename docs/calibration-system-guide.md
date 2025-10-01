# Sistema de Calibración TUPÁ Hub - Guía Completa

## 📋 Resumen Ejecutivo

El Sistema de Calibración TUPÁ Hub es una solución completa para gestionar y optimizar la calibración de café espresso, diseñada para baristas profesionales y tostadores. Incluye 6 fases de funcionalidades desde gestión básica hasta PWA offline y telemetría avanzada.

## 🎯 Fases Implementadas

### Fase 1: Database Schema ✅
- **Tablas creadas**: `grinders`, `coffee_profiles`, `calibration_entries`, `calibration_settings`
- **RLS Policies**: Seguridad granular por ubicación y roles
- **Funciones DB**: 
  - `calculate_brew_ratio()`: Cálculo automático de ratio
  - `validate_single_approved_per_shift()`: Un aprobado por turno
  - `get_calibration_suggestion()`: Sugerencias inteligentes
- **Triggers**: Auto-cálculo de ratio, timestamp updates, validaciones

### Fase 2: Core Modal Component ✅
- **CalibrationCalculator.tsx**: Modal fullscreen con:
  - Header fijo con café/fecha/turno/barista
  - Steppers táctiles grandes (44px+) con auto-incremento
  - Toggle g/ml con densidad configurable
  - Chips de notas + textarea
  - Preview ratio/tiempo con semáforo en tiempo real
  - Footer: Guardar/Duplicar/Revertir/Aprobar
- **Botón flotante**: "Calibración" en header de recipes

### Fase 3: Business Logic & Validations ✅
- **Hooks personalizados**:
  - `useCalibrationEntries`: CRUD de calibraciones
  - `useCoffeeProfiles`: Gestión de perfiles de café
  - `useCalibrationSettings`: Configuración global
  - `useDebounce`: Optimización de cálculos (200ms)
- **Cálculos automáticos** en `calibration-utils.ts`:
  - `calculateRatio()`: Ratio automático con densidad
  - `validateCalibration()`: Errores críticos y warnings
  - `evaluateSemaphore()`: Estado de semáforo gradual
  - `generateSuggestions()`: Sugerencias contextuales
- **Validaciones**:
  - dose_g > 0 (crítico)
  - yield_value > 0 (crítico)
  - time_s > 0 (crítico)
  - Cambios bruscos molienda (warning)
  - 1 aprobado/turno (constraint DB)

### Fase 4: History & Templates Tabs ✅
- **CalibrationHistory.tsx**: Tabla táctil con:
  - Filtros: café, turno, estado, fecha
  - Búsqueda en notas
  - Stats cards: total, aprobadas, pendientes
  - Export CSV
  - Semáforo visual por entrada
- **CalibrationTemplates.tsx**: Gestión de objetivos:
  - CRUD de perfiles de café
  - Configuración de parámetros objetivo
  - Asignación de molinos
  - Gestión de lotes y tueste
- **Tabs integrados** en /app/recipes

### Fase 5: PWA & Offline ✅
- **Service Worker**: Cache de recursos y runtime
- **IndexedDB** (`offline-db.ts`):
  - `offline-queue`: Cola de sincronización
  - `cached-profiles`: Perfiles cacheados
  - `draft-calibrations`: Borradores auto-guardados
- **Hooks offline**:
  - `useOfflineSync()`: Estado y sincronización
  - `useOfflineCalibration()`: Operaciones offline
- **Features**:
  - Auto-save drafts cada 30s
  - Cola de sincronización automática
  - Background Sync API
  - Indicadores visuales de estado
- **PWA Manifest**: Instalación en dispositivos

### Fase 6: Advanced Features ✅
- **Telemetría** (`telemetry.ts`):
  - Tracking de eventos de calibración
  - Métricas: tiempo hasta aprobado, reversiones, tasa de éxito
  - Validación con Zod
  - `CalibrationSession` class para tracking de sesión
- **CalibrationGuide.tsx**: Reglas visuales:
  - Estado de parámetros en tiempo real
  - Reglas de extracción (sub/sobre-extraído)
  - Guía de ajustes por parámetro
  - Tips diarios
  - Preparación para integración TDS/EY%
- **TelemetryDashboard.tsx**: 
  - Métricas visuales (últimos 30 días)
  - KPIs: tiempo promedio, tasa de éxito, reversiones
  - Desglose de eventos
  - Indicador de rendimiento
- **Tab Telemetría**: Integrado en /app/recipes

## 🔒 Seguridad

### Input Validation
- **Zod schemas** para validación de tipos
- **Client-side validation** con mensajes claros
- **Server-side validation** vía RLS policies
- **Sanitización** de inputs antes de guardar
- No uso de `dangerouslySetInnerHTML`

### Telemetry Security
- Tokens de autenticación en headers
- Validación de eventos antes de guardar
- Logs en tabla `pos_logs` con scope específico
- Sin exposición de datos sensibles

## 📊 Arquitectura de Datos

### Coffee Profiles
```typescript
{
  id: uuid,
  name: string,
  brew_method: string,
  target_dose_g: number,
  target_ratio_min: number,
  target_ratio_max: number,
  target_time_min: number,
  target_time_max: number,
  target_temp_c: number,
  grinder_id: uuid,
  tueste: string,
  lote: string,
  active: boolean
}
```

### Calibration Entries
```typescript
{
  id: uuid,
  coffee_profile_id: uuid,
  fecha: date,
  turno: 'mañana' | 'tarde' | 'noche',
  barista_id: uuid,
  dose_g: number,
  yield_value: number,
  yield_unit: 'g' | 'ml',
  time_s: number,
  temp_c: number,
  grind_points: number,
  ratio_calc: number, // auto-calculated
  notes_tags: string[],
  notes_text: string,
  approved: boolean,
  approved_by: uuid,
  approved_at: timestamp
}
```

### Telemetry Events
```typescript
{
  event_type: 'calibration_started' | 'calibration_saved' | 'calibration_approved' | ...,
  calibration_id: uuid,
  coffee_profile_id: uuid,
  location_id: uuid,
  user_id: uuid,
  metadata: {
    time_to_approval_seconds: number,
    revision_count: number,
    grind_adjustments: number,
    initial_status: 'success' | 'warning' | 'error',
    final_status: 'success' | 'warning' | 'error'
  }
}
```

## 🎨 Componentes UI

### Atomic Components
- **Stepper**: Control táctil grande con +/- y auto-incremento
- **OfflineSyncStatus**: Badge de estado de conexión
- **OfflineIndicator**: Flotante con cola de sincronización

### Feature Components
- **CalibrationCalculator**: Modal principal de calibración
- **CalibrationHistory**: Tabla con filtros y export
- **CalibrationTemplates**: Gestión de perfiles
- **CalibrationGuide**: Reglas y sugerencias visuales
- **TelemetryDashboard**: Métricas y KPIs

## 🔄 Flujo de Usuario

### Crear Calibración
1. Click en "Calibración" en recipes
2. Seleccionar café y turno
3. Ajustar parámetros con steppers
4. Ver guía de calibración en tiempo real
5. Agregar notas y tags
6. Guardar (local si offline)
7. Aprobar cuando esté lista

### Trabajar Offline
1. Abrir app sin conexión
2. Crear calibración normalmente
3. Se guarda en IndexedDB
4. Auto-save de borradores cada 30s
5. Al recuperar conexión: sincronización automática
6. Notificación de sincronización completa

### Ver Telemetría
1. Ir a tab "Telemetría" en recipes
2. Ver métricas de últimos 30 días
3. Analizar tiempo promedio, tasa de éxito
4. Identificar oportunidades de mejora

## 🚀 Próximas Integraciones

### TDS & EY% (Planificado)
- **Refractómetros soportados**:
  - Atago PAL-COFFEE
  - VST LAB Coffee III
  - DiFluid R2 Extract
- **Métricas adicionales**:
  - TDS (Total Dissolved Solids): 1.15-1.45%
  - EY% (Extraction Yield): 18-22%
- **Features**:
  - Gráficos de calidad en tiempo real
  - Histórico de TDS por café/lote
  - Correlación con parámetros de calibración
  - Alertas de calidad

### Integración Bluetooth
- Conexión directa con refractómetros
- Lectura automática de TDS
- Sincronización de mediciones con calibraciones

## 📱 PWA Installation

### Chrome/Edge (Desktop)
```bash
# Usuario ve icono de instalación (+) en barra de direcciones
Click → Instalar
```

### Android (Chrome)
```bash
Menú (⋮) → Agregar a pantalla de inicio → Instalar
```

### iOS (Safari)
```bash
Botón Compartir → Agregar a pantalla de inicio
```

## 🛠️ Development

### Requisitos
- Node.js 18+
- npm/yarn/pnpm/bun
- Supabase CLI (para migraciones)

### Setup Local
```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck
```

### Testing Offline
```bash
# Chrome DevTools
F12 → Network → Throttling → Offline

# Verificar IndexedDB
F12 → Application → Storage → IndexedDB → tupa-calibration-db

# Verificar Service Worker
F12 → Application → Service Workers
```

## 📈 Métricas de Éxito

### KPIs Principales
- **Tiempo Promedio de Calibración**: <5 minutos ideal
- **Tasa de Éxito**: >80% calibraciones aprobadas al primer intento
- **Reversiones**: <20% de las calibraciones requieren ajustes
- **Uso Offline**: >30% de calibraciones creadas offline

### Performance
- **First Contentful Paint**: <1.5s
- **Time to Interactive**: <3.5s
- **Lighthouse Score**: >90 en todos los criterios

## 🐛 Troubleshooting

### Calibración no se guarda
1. Verificar IndexedDB habilitado
2. Limpiar storage del navegador
3. Verificar permisos de almacenamiento

### No sincroniza offline
1. Verificar conexión a internet
2. Intentar sincronización manual
3. Revisar logs de Service Worker

### Telemetría no muestra datos
1. Verificar que existen calibraciones
2. Cambiar rango de fechas
3. Verificar permisos de acceso

## 📚 Referencias

- [PWA Best Practices](https://web.dev/pwa-checklist/)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Zod Documentation](https://zod.dev/)
- [SCA Brewing Standards](https://sca.coffee/research/protocols-best-practices)

---

**Versión**: 1.0.0
**Última actualización**: 2025-10-01
**Mantenido por**: TUPÁ Tech Team
