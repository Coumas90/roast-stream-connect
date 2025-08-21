import { describe, it, expect, beforeEach } from 'vitest';
import { scrub, SecureLogger } from '../supabase/functions/_shared/secure-logger';

describe('Secure Logger', () => {
  describe('scrub function', () => {
    it('should redact sensitive headers', () => {
      const input = {
        'authorization': 'Bearer secret-token',
        'x-api-key': 'api-key-123',
        'cookie': 'session=abc123',
        'normal-header': 'safe-value'
      };

      const result = scrub(input);

      expect(result.authorization).toBe('***redacted***');
      expect(result['x-api-key']).toBe('***redacted***');
      expect(result.cookie).toBe('***redacted***');
      expect(result['normal-header']).toBe('safe-value');
    });

    it('should create fingerprints for tokens', () => {
      const input = {
        'access_token': 'very-secret-token-123',
        'refresh_token': 'another-secret-456',
        'password': 'user-password',
        'safe_field': 'safe-value'
      };

      const result = scrub(input);

      expect(result.access_token).toMatch(/\*\*\*fingerprint:very\.\.\.123\*\*\*/);
      expect(result.refresh_token).toMatch(/\*\*\*fingerprint:anot\.\.\.456\*\*\*/);
      expect(result.password).toBe('***redacted***');
      expect(result.safe_field).toBe('safe-value');
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: 'John',
          password: 'secret123'
        },
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json'
        }
      };

      const result = scrub(input);

      expect(result.user.name).toBe('John');
      expect(result.user.password).toBe('***redacted***');
      expect(result.headers.authorization).toBe('***redacted***');
      expect(result.headers['content-type']).toBe('application/json');
    });

    it('should handle arrays', () => {
      const input = {
        tokens: ['token-1', 'token-2'],
        users: [{ name: 'John', api_key: 'secret' }]
      };

      const result = scrub(input);

      expect(Array.isArray(result.tokens)).toBe(true);
      expect(result.users[0].name).toBe('John');
      expect(result.users[0].api_key).toBe('***redacted***');
    });

    it('should handle null and undefined values', () => {
      const input = {
        nullValue: null,
        undefinedValue: undefined,
        password: null,
        token: undefined
      };

      const result = scrub(input);

      expect(result.nullValue).toBeNull();
      expect(result.undefinedValue).toBeUndefined();
      expect(result.password).toBeNull();
      expect(result.token).toBeUndefined();
    });
  });

  describe('SecureLogger class', () => {
    let logger: SecureLogger;
    let consoleSpy: any;

    beforeEach(() => {
      logger = new SecureLogger('test-service', 'test');
      consoleSpy = {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      };
      
      // Mock console methods
      global.console = consoleSpy as any;
    });

    it('should emit JSON logs with required fields', () => {
      logger.info('test_event', { custom_field: 'value' });

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const loggedData = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      
      expect(loggedData.ts).toBeDefined();
      expect(loggedData.level).toBe('info');
      expect(loggedData.service).toBe('test-service');
      expect(loggedData.env).toBe('test');
      expect(loggedData.event).toBe('test_event');
      expect(loggedData.custom_field).toBe('value');
    });

    it('should scrub sensitive data in logs', () => {
      logger.info('auth_event', { 
        authorization: 'Bearer secret',
        user_id: '123',
        access_token: 'very-secret'
      });

      const loggedData = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      
      expect(loggedData.authorization).toBe('***redacted***');
      expect(loggedData.user_id).toBe('123');
      expect(loggedData.access_token).toMatch(/\*\*\*fingerprint:/);
    });

    it('should handle error logging with Error objects', () => {
      const error = new Error('Test error');
      logger.error('error_event', error, { context: 'test' });

      const loggedData = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      
      expect(loggedData.level).toBe('error');
      expect(loggedData.error_message).toBe('Test error');
      expect(loggedData.error_stack).toBeDefined();
      expect(loggedData.context).toBe('test');
    });

    it('should handle rotation-specific logging', () => {
      logger.rotationEvent('rotation_start', 'fudo', 'loc-123', 'rot-456', {
        attempt: 1
      });

      const loggedData = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      
      expect(loggedData.event).toBe('rotation_start');
      expect(loggedData.provider).toBe('fudo');
      expect(loggedData.location_id).toBe('loc-123');
      expect(loggedData.rotation_id).toBe('rot-456');
      expect(loggedData.attempt).toBe(1);
    });

    it('should handle circuit breaker logging', () => {
      logger.circuitBreakerEvent('cb_opened', 'fudo', 'open', 'loc-123', {
        failures: 5
      });

      const loggedData = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      
      expect(loggedData.event).toBe('cb_opened');
      expect(loggedData.provider).toBe('fudo');
      expect(loggedData.cb_state).toBe('open');
      expect(loggedData.location_id).toBe('loc-123');
      expect(loggedData.failures).toBe(5);
    });
  });
});