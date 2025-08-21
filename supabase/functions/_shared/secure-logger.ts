// Secure JSON Logger with Scrubber for Sensitive Data
// Ensures no tokens, secrets, or PII leak into logs

export interface LogFields {
  ts?: string;
  level?: 'info' | 'warn' | 'error';
  service?: string;
  env?: string;
  tenant?: string;
  provider?: string;
  location_id?: string;
  attempt?: number;
  elapsed_ms?: number;
  rotation_id?: string;
  cb_state?: string;
  request_id?: string;
  [key: string]: unknown;
}

// Sensitive field patterns to scrub
const SENSITIVE_HEADERS = [
  'authorization',
  'x-api-key', 
  'x-api-secret',
  'cookie',
  'set-cookie',
  'x-auth-token',
  'bearer',
  'api-key',
  'api_key'
];

const SENSITIVE_FIELDS = [
  'access_token',
  'refresh_token', 
  'token',
  'password',
  'secret',
  'key',
  'credential',
  'auth',
  'bearer',
  'ciphertext'
];

// Create safe fingerprint for sensitive values
async function createFingerprint(value: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hex = Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return `sha256:${hex.substring(0, 12)}...`;
  } catch {
    return 'sha256:unknown...';
  }
}

// Deep scrub object to remove sensitive data
function scrubValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  const keyLower = key.toLowerCase();
  const isSensitiveHeader = SENSITIVE_HEADERS.some(pattern => keyLower.includes(pattern));
  const isSensitiveField = SENSITIVE_FIELDS.some(pattern => keyLower.includes(pattern));
  
  if (isSensitiveHeader || isSensitiveField) {
    if (typeof value === 'string' && value.length > 0) {
      // For tokens/secrets, create fingerprint for correlation
      if (keyLower.includes('token') || keyLower.includes('secret') || keyLower.includes('key')) {
        return `***fingerprint:${value.substring(0, 4)}...${value.slice(-4)}***`;
      }
      return '***redacted***';
    }
    return '***redacted***';
  }

  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.map((item, index) => scrubValue(`${key}[${index}]`, item));
    } else {
      const scrubbed: Record<string, unknown> = {};
      for (const [objKey, objValue] of Object.entries(value)) {
        scrubbed[objKey] = scrubValue(objKey, objValue);
      }
      return scrubbed;
    }
  }

  return value;
}

// Main scrubber function
export function scrub(fields: LogFields): LogFields {
  const scrubbed: LogFields = {};
  
  for (const [key, value] of Object.entries(fields)) {
    scrubbed[key] = scrubValue(key, value);
  }
  
  return scrubbed;
}

// Logger class with standardized JSON format
export class SecureLogger {
  private service: string;
  private env: string;

  constructor(service: string, env = 'production') {
    this.service = service;
    this.env = env;
  }

  private formatMessage(level: 'info' | 'warn' | 'error', event: string, fields: LogFields = {}): string {
    const baseFields: LogFields = {
      ts: new Date().toISOString(),
      level,
      service: this.service,
      env: this.env,
      event,
      ...fields
    };

    // Always scrub before emitting
    const scrubbedFields = scrub(baseFields);
    
    return JSON.stringify(scrubbedFields);
  }

  info(event: string, fields: LogFields = {}): void {
    console.log(this.formatMessage('info', event, fields));
  }

  warn(event: string, fields: LogFields = {}): void {
    console.warn(this.formatMessage('warn', event, fields));
  }

  error(event: string, errorOrFields?: Error | LogFields, additionalFields: LogFields = {}): void {
    let fields = additionalFields;
    
    if (errorOrFields instanceof Error) {
      fields = {
        error_message: errorOrFields.message,
        error_stack: errorOrFields.stack,
        ...additionalFields
      };
    } else if (errorOrFields) {
      fields = { ...errorOrFields, ...additionalFields };
    }

    console.error(this.formatMessage('error', event, fields));
  }

  // Helper for rotation-specific logging
  rotationEvent(
    event: string, 
    provider: string, 
    locationId: string, 
    rotationId: string,
    additionalFields: LogFields = {}
  ): void {
    this.info(event, {
      provider,
      location_id: locationId,
      rotation_id: rotationId,
      ...additionalFields
    });
  }

  // Helper for circuit breaker logging
  circuitBreakerEvent(
    event: string,
    provider: string,
    state: string,
    locationId?: string,
    additionalFields: LogFields = {}
  ): void {
    this.info(event, {
      provider,
      cb_state: state,
      location_id: locationId,
      ...additionalFields
    });
  }
}

// Export default instances for common services
export const fudoLogger = new SecureLogger('fudo-rotate-token');
export const interceptorLogger = new SecureLogger('fudo-interceptor');
export const healthcheckLogger = new SecureLogger('cron-healthcheck');