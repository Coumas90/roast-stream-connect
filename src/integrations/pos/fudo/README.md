# Fudo Integration Guide

## Arquitectura

### Core Components
- **`client.ts`**: HTTP client + intelligent 401 handling (no retry for zombie tokens)
- **`service.ts`**: Business operations (rotation, fetch, sync)
- **`mapper.ts`**: Fudo response → TUPÁ domain mapping
- **`types.ts`**: TypeScript contracts and interfaces
- **`metrics.ts`**: Observability metrics and traces
- **`config.ts`**: Centralized configuration with governance

### Architecture Principles
- **Single Responsibility**: Each module has one clear purpose
- **Error Boundaries**: Robust error handling with circuit breakers
- **Observability First**: Every operation produces metrics and traces
- **Configuration Governance**: DB → ENV → defaults pattern

## Flujo 401 / Token Rotation

### Intelligent 401 Detection
```typescript
// 1. 401 detected → check for "zombie token"
if (error.status === 401) {
  if (isZombieToken(token)) {
    // 2. Zombie token → NO RETRY, fail fast <100ms
    throw new Error("Token zombie detected - rotation required");
  } else {
    // 3. Expired token → trigger single-flight rotation
    await rotateOnDemand(locationId);
  }
}
```

### Circuit Breaker Protection
- **Per-location breakers**: Open after N consecutive failures
- **Cooldown periods**: Configurable backoff strategies  
- **Half-open testing**: Gradual recovery validation
- **Metrics tracking**: All state transitions recorded

### Token Lifecycle
1. **Active**: Valid token, normal operations
2. **Expiring**: Within buffer window, rotation scheduled
3. **Zombie**: Old token after rotation, immediate 401
4. **Rotated**: New token activated, old token marked zombie

## Configuración

### Governance Pattern
```typescript
// Priority: Database → Environment → Safe Defaults
const config = await loadFudoConfig();
// Uses: pos_settings + ENV vars + hardcoded fallbacks
```

### Key Configuration Points
```bash
# Environment Variables (Override DB settings)
FUDO_API_TIMEOUT_MS=30000      # Aligned with edge functions
FUDO_MAX_RETRIES=2             # Aligned with chaos tests  
FUDO_CB_THRESHOLD=10           # Aligned with alert rules
FUDO_RPM_LIMIT=60              # Rate limiting protection
```

### Database Settings
```sql
-- pos_settings table controls runtime behavior
INSERT INTO pos_settings (key, value, description) VALUES
('fudo_api_timeout_ms', 30000, 'HTTP timeout for Fudo API calls'),
('fudo_max_retries', 2, 'Maximum retry attempts for failed requests'),
('fudo_cb_threshold', 10, 'Circuit breaker failure threshold');
```

## Testing Strategy

### Unit Tests
- **Token Zombie Detection**: Guarantees <100ms response for zombie tokens
- **Circuit Breaker Logic**: State transitions and thresholds
- **Mapper Functions**: Fudo → TUPÁ data transformation
- **Configuration Loading**: DB → ENV → defaults precedence

### Integration Tests  
- **End-to-end flows**: Complete sync operations
- **Error scenarios**: Network failures, API errors, timeouts
- **Token rotation**: Full lifecycle including zombie detection

### Chaos Engineering
```bash
# Production-like testing scenarios
npm run test:chaos:fudo:500         # Server errors
npm run test:chaos:fudo:timeout     # Network timeouts  
npm run test:chaos:fudo:overload    # Rate limit scenarios
npm run test:chaos:fudo:zombie      # Token zombie detection
```

### UAT (User Acceptance Testing)
```bash
# Quick production readiness check
node scripts/uat-test-runner.js
# Generates: artifacts/uat/token-zombie-*.json
```

## Metrics & Observability

### HTTP Metrics Convention
- `fudo_http_requests_total{endpoint,method,status}`
- `fudo_http_latency_ms{endpoint,method}`
- `fudo_http_errors_total{endpoint,method,error_type}`

### Rotation Metrics
- `fudo_rotation_attempts_total{reason}` (expiry, failure, manual)
- `fudo_rotation_success_total` / `fudo_rotation_fail_total`
- `fudo_rotation_duration_ms{phase}` (validate, swap, notify)

### Circuit Breaker Metrics
- `fudo_cb_state{location}` (0=closed, 1=open, 0.5=half-open)
- `fudo_cb_transitions_total{from_state,to_state}`
- `fudo_cb_blocked_requests_total{location}`

### Token Metrics
- `fudo_token_age_hours{location}` (time since last rotation)
- `fudo_token_zombie_detections_total{location}`
- `fudo_token_expiry_buffer_hours{location}` (time until expiry)

## Developer Commands

### Local Development
```bash
# Setup Fudo integration environment  
npm run dev:fudo:setup

# Run specific Fudo tests
npm run test:fudo                    # Unit tests only
npm run test:fudo:integration        # Integration tests
npm run test:fudo:chaos             # Chaos engineering

# Configuration debugging
npm run fudo:config:show            # Display resolved config
npm run fudo:config:validate        # Verify all settings
```

### Production Operations
```bash
# Health checks
npm run fudo:health                 # Overall system health
npm run fudo:metrics               # Current metrics snapshot
npm run fudo:breakers             # Circuit breaker status

# Token management
npm run fudo:tokens:status        # Token expiry status
npm run fudo:tokens:rotate        # Manual rotation trigger
npm run fudo:tokens:validate      # Validate all tokens
```

## Extending for New Providers

### 1. Create Provider Structure
```
src/integrations/pos/newprovider/
├── client.ts       # HTTP client with provider-specific auth
├── service.ts      # Implements POSService interface  
├── mapper.ts       # Provider → TUPÁ transformations
├── types.ts        # Provider-specific types
├── config.ts       # Configuration with same governance pattern
└── README.md       # Provider-specific documentation
```

### 2. Implement Core Interfaces
```typescript
// service.ts - Required implementation
export class NewProviderService implements POSService {
  readonly meta: POSMeta = {
    id: "newprovider",
    label: "New Provider POS",
    version: "1.0.0",
    kindsSupported: ["orders", "products"],
    // ...
  };
  
  async sync(kind: POSKind, since?: string): Promise<number> {
    // Implementation here
  }
}
```

### 3. Add to Registry
```typescript
// src/integrations/pos/registry.ts
import { newProviderFactory } from "./newprovider/service";

export const POS_REGISTRY: Record<POSProviderId, POSAdapterFactory> = {
  fudo: fudoFactory,
  bistrosoft: bistrosoftFactory,
  newprovider: newProviderFactory,  // Add here
  // ...
};
```

## Production Checklist (Mini DoD)

### Configuration ✅
- [ ] Config follows DB → ENV → defaults pattern
- [ ] All timeouts/retries aligned with chaos tests
- [ ] Numbers consistent across alert rules
- [ ] Configuration audit logged at startup

### Testing ✅  
- [ ] Token Zombie test running in CI (<100ms guarantee)
- [ ] Chaos tests pass for all error scenarios
- [ ] UAT generates production-readiness artifacts
- [ ] Integration tests cover full sync workflow

### Observability ✅
- [ ] All operations produce structured metrics
- [ ] Logs redact secrets (API keys, tokens)
- [ ] Trace IDs propagated through call chains
- [ ] Circuit breaker state changes logged

### Security ✅
- [ ] No secrets in logs or error messages
- [ ] Token rotation uses atomic database operations
- [ ] Zombie token detection prevents replay attacks
- [ ] Rate limiting protects against API abuse

### Documentation ✅
- [ ] README covers architecture and flows
- [ ] Developer commands documented and tested
- [ ] Extension patterns explained with examples
- [ ] Production runbook available

---

## Quick Start for New Developers

```bash
# 1. Understand the architecture
cat src/integrations/pos/fudo/README.md

# 2. Run the test suite
npm run test:fudo

# 3. See it in action with chaos testing
npm run test:chaos:fudo:zombie

# 4. Check current production health
npm run fudo:health
```

**Key principle**: Fail fast, recover gracefully, observe everything.