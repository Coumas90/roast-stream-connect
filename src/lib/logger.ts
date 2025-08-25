/**
 * Card 1.4: Structured Logging - Security-aware logger
 * Replaces console.log with structured logging that redacts secrets
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  locationId?: string;
  provider?: string;
  duration?: number;
  [key: string]: unknown;
}

class SecureLogger {
  private isDevelopment = import.meta.env.DEV;
  
  // Sensitive fields that should be redacted in logs
  private sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'auth',
    'credential',
    'api_key',
    'apiKey',
    'secret_ref',
    'ciphertext',
    'encrypted'
  ];

  private redactSensitiveData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.redactSensitiveData(item));
    }

    const redacted: any = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = this.sensitiveFields.some(field => 
        lowerKey.includes(field)
      );

      if (isSensitive && typeof value === 'string') {
        redacted[key] = value.length > 0 ? '***REDACTED***' : '';
      } else if (typeof value === 'object') {
        redacted[key] = this.redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const safeContext = context ? this.redactSensitiveData(context) : {};
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...safeContext
    };

    // In development, also log to console for debugging
    if (this.isDevelopment) {
      const consoleMethod = level === 'error' ? console.error : 
                           level === 'warn' ? console.warn : 
                           level === 'debug' ? console.debug : 
                           console.log;
      
      consoleMethod(`[${level.toUpperCase()}]`, message, safeContext);
    }

    // In production, send to structured logging service
    // For now, we'll use console.log but in a structured format
    if (!this.isDevelopment) {
      console.log(JSON.stringify(logEntry));
    }
  }

  debug(message: string, context?: LogContext): void {
    this.formatMessage('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.formatMessage('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.formatMessage('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.formatMessage('error', message, context);
  }

  // Performance logging helper
  time(label: string): void {
    if (this.isDevelopment) {
      console.time(label);
    }
  }

  timeEnd(label: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.timeEnd(label);
    }
    this.info(`Performance: ${label} completed`, context);
  }
}

// Export singleton instance
export const logger = new SecureLogger();

// Helper for migration from console.log
export function logInfo(message: string, data?: any): void {
  logger.info(message, { data });
}

export function logError(message: string, error?: Error, context?: LogContext): void {
  logger.error(message, { 
    error: error?.message,
    stack: error?.stack,
    ...context 
  });
}

export function logWarn(message: string, context?: LogContext): void {
  logger.warn(message, context);
}