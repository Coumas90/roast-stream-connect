# PWA & Funcionalidades Offline - Guía de Usuario

## 🌐 Resumen

TUPÁ Hub ahora es una Progressive Web App (PWA) con capacidades offline completas, permitiendo a los baristas trabajar sin conexión a internet y sincronizar automáticamente cuando la conexión se restaura.

## ✨ Características Implementadas

### 1. Service Worker & Cache
- **Cache de recursos críticos**: Scripts, estilos e imágenes se cachean automáticamente
- **Estrategia Network-First**: Intenta obtener datos frescos de la red primero, con fallback a cache
- **Cache runtime**: Respuestas exitosas se cachean para uso offline

### 2. IndexedDB para Persistencia Local
La app utiliza IndexedDB para almacenar tres tipos de datos:

#### Offline Queue (`offline-queue`)
- Cola de operaciones pendientes cuando no hay conexión
- Cada entrada incluye: URL, método HTTP, headers, datos y conteo de reintentos
- Se sincroniza automáticamente cuando se detecta conexión

#### Cached Profiles (`cached-profiles`)
- Perfiles de café activos cacheados localmente
- Incluye parámetros de calibración objetivo
- Actualizado automáticamente cuando cambian

#### Draft Calibrations (`draft-calibrations`)
- Borradores de calibraciones guardados automáticamente cada 30 segundos
- Persiste datos entre sesiones
- Se carga automáticamente al abrir el modal

### 3. Sincronización Automática

#### Background Sync
- Se registra automáticamente cuando hay items en cola
- Se ejecuta cuando el navegador detecta conectividad
- Notifica al usuario del resultado de la sincronización

#### Manual Sync
- Botón manual de sincronización en el indicador offline
- Procesa todos los items pendientes en la cola
- Maneja errores de servidor vs. errores de cliente

### 4. Indicadores Visuales

#### OfflineIndicator (Global)
- Flotante en la esquina inferior derecha
- Muestra estado de conexión con iconos
- Badge con conteo de items pendientes
- Botón de sincronización manual cuando está online
- Solo visible cuando hay items pendientes o está offline

#### OfflineSyncStatus (En CalibrationCalculator)
- Badge en el header del modal de calibración
- Indica estado Online/Offline en tiempo real
- Ayuda al usuario a saber si sus cambios se guardarán localmente

## 🔧 Uso para Baristas

### Trabajar Offline

1. **Abrir la App**
   - La app se carga normalmente incluso sin conexión
   - Recursos críticos se sirven desde cache

2. **Crear Calibración Offline**
   - Completa todos los campos normalmente
   - Click en "Guardar" → Se guarda en cola local
   - Aparece notificación: "Guardado localmente, se sincronizará cuando haya conexión"

3. **Auto-guardado de Borradores**
   - Tus cambios se guardan automáticamente cada 30 segundos
   - Si cierras la app y la vuelves a abrir, recupera el último borrador

4. **Ver Items Pendientes**
   - El indicador offline muestra cuántos items están en cola
   - Ej: "3 pendientes"

### Sincronización

1. **Automática**
   - Cuando la conexión se restaura, aparece toast: "Conexión restaurada, sincronizando..."
   - Background Sync se activa automáticamente
   - Al completar: "Sincronización completa - 3 elementos procesados"

2. **Manual**
   - Click en botón "Sincronizar" en el indicador offline
   - Útil si la sincronización automática falla
   - Procesa inmediatamente todos los items

## 📱 Instalación como PWA

### Android (Chrome)
1. Abre la app en Chrome
2. Toca el menú (⋮) → "Agregar a pantalla de inicio"
3. Confirma la instalación
4. La app aparecerá como una app nativa

### iOS (Safari)
1. Abre la app en Safari
2. Toca el botón de compartir
3. Selecciona "Agregar a pantalla de inicio"
4. Confirma

### Desktop (Chrome/Edge)
1. Busca el icono de instalación (+) en la barra de direcciones
2. Click en "Instalar"
3. La app se abre en ventana independiente

## 🔍 Verificación

### Probar Modo Offline
1. Abrir DevTools (F12)
2. Ir a la pestaña "Network"
3. Cambiar throttling a "Offline"
4. Intentar guardar una calibración
5. Verificar que aparece en la cola
6. Cambiar throttling a "Online"
7. Verificar sincronización automática

### Inspeccionar IndexedDB
1. Abrir DevTools (F12)
2. Ir a "Application" → "Storage" → "IndexedDB"
3. Expandir "tupa-calibration-db"
4. Ver contenido de cada store:
   - `offline-queue`: Items pendientes
   - `cached-profiles`: Perfiles cacheados
   - `draft-calibrations`: Borradores guardados

### Logs del Service Worker
1. Abrir DevTools (F12)
2. Ir a "Application" → "Service Workers"
3. Ver status del SW (activo/instalado)
4. Ver logs en Console

## ⚠️ Limitaciones

1. **Tamaño de Cache**
   - Los navegadores limitan el storage disponible
   - Generalmente >50MB disponible
   - La app limpia caches antiguos automáticamente

2. **Background Sync**
   - No todos los navegadores soportan Background Sync API
   - Fallback: Sincronización manual siempre disponible
   - iOS Safari: Requiere sincronización manual

3. **Tiempo de Vida del SW**
   - Los Service Workers pueden ser terminados por el sistema
   - La app re-registra el SW automáticamente

## 🐛 Troubleshooting

### "No se guardó la calibración"
- Verificar que IndexedDB está habilitado en el navegador
- Limpiar storage del navegador y recargar la app
- Verificar permisos de almacenamiento

### "No se sincroniza automáticamente"
- Intentar sincronización manual
- Verificar que hay conexión a internet estable
- Revisar logs del Service Worker en DevTools

### "Borrador no se carga"
- Esperar 30 segundos después de hacer cambios
- Verificar que el modal se abrió correctamente
- Limpiar borradores antiguos desde IndexedDB

## 📊 Mejoras Futuras

- [ ] Compresión de datos en IndexedDB
- [ ] Límite de edad para borradores (ej: 7 días)
- [ ] Exportación de cola offline como backup
- [ ] Retry con backoff exponencial
- [ ] Notificaciones push cuando sync completa
- [ ] Modo offline-first configurable
- [ ] Sincronización selectiva (por prioridad)

## 🔐 Seguridad

- Tokens de autenticación se almacenan de forma segura
- IndexedDB solo accesible desde el mismo origen
- Service Worker solo sirve recursos del mismo dominio
- Headers de autenticación incluidos en requests de sincronización

## 📚 Referencias Técnicas

- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Sync_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
