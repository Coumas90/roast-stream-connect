import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  sendSlackAlert, 
  sendEmailAlert, 
  alertCircuitBreakerOpen, 
  alertRotationFailures, 
  alertHealthcheckFailed,
  AlertPayload 
} from '../supabase/functions/_shared/alerts';

// Mock fetch globally
global.fetch = vi.fn();

describe('Alert System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    
    // Reset environment variables
    vi.stubEnv('SLACK_WEBHOOK_URL', 'https://hooks.slack.com/test');
    vi.stubEnv('RESEND_API_KEY', 'test-api-key');
  });

  describe('sendSlackAlert', () => {
    it('should send Slack alert with correct payload', async () => {
      const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
      (fetch as any).mockResolvedValueOnce(mockResponse);

      const payload: AlertPayload = {
        type: 'circuit_breaker_open',
        provider: 'fudo',
        location_id: 'loc-123',
        severity: 'error',
        title: 'Circuit Breaker Opened',
        message: 'Circuit breaker opened due to failures'
      };

      const result = await sendSlackAlert(payload);

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('https://hooks.slack.com/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('Circuit Breaker Opened')
      });
    });

    it('should suppress duplicate alerts within 15 minutes', async () => {
      const payload: AlertPayload = {
        type: 'circuit_breaker_open',
        provider: 'fudo',
        location_id: 'loc-123',
        severity: 'error',
        title: 'Circuit Breaker Opened',
        message: 'Test message'
      };

      const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
      (fetch as any).mockResolvedValue(mockResponse);

      // Send first alert
      const result1 = await sendSlackAlert(payload);
      expect(result1).toBe(true);

      // Send duplicate alert immediately
      const result2 = await sendSlackAlert(payload);
      expect(result2).toBe(false); // Should be suppressed

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should return false if webhook URL not configured', async () => {
      vi.stubEnv('SLACK_WEBHOOK_URL', '');

      const payload: AlertPayload = {
        type: 'custom',
        provider: 'fudo',
        severity: 'info',
        title: 'Test',
        message: 'Test message'
      };

      const result = await sendSlackAlert(payload);

      expect(result).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should handle Slack API errors gracefully', async () => {
      const mockResponse = new Response('Error', { status: 500 });
      (fetch as any).mockResolvedValueOnce(mockResponse);

      const payload: AlertPayload = {
        type: 'custom',
        provider: 'fudo',
        severity: 'error',
        title: 'Test Error',
        message: 'Test message'
      };

      const result = await sendSlackAlert(payload);

      expect(result).toBe(false);
    });
  });

  describe('sendEmailAlert', () => {
    it('should send email alert with correct payload', async () => {
      const mockResponse = new Response(JSON.stringify({ id: 'email-123' }), { status: 200 });
      (fetch as any).mockResolvedValueOnce(mockResponse);

      const payload: AlertPayload = {
        type: 'rotation_failures',
        provider: 'fudo',
        location_id: 'loc-123',
        severity: 'warn',
        title: 'Rotation Failures',
        message: '3 consecutive failures detected'
      };

      const result = await sendEmailAlert(payload);

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json'
        },
        body: expect.stringContaining('Rotation Failures')
      });
    });

    it('should return false if API key not configured', async () => {
      vi.stubEnv('RESEND_API_KEY', '');

      const payload: AlertPayload = {
        type: 'custom',
        provider: 'fudo',
        severity: 'info',
        title: 'Test',
        message: 'Test message'
      };

      const result = await sendEmailAlert(payload);

      expect(result).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('alertCircuitBreakerOpen', () => {
    it('should send both Slack and email alerts', async () => {
      const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
      (fetch as any).mockResolvedValue(mockResponse);

      await alertCircuitBreakerOpen('fudo', 'loc-123', 10, '2024-01-01T12:00:00Z');

      // Should call fetch twice: once for Slack, once for email
      expect(fetch).toHaveBeenCalledTimes(2);
      
      // Check Slack call
      expect(fetch).toHaveBeenCalledWith('https://hooks.slack.com/test', expect.any(Object));
      
      // Check email call
      expect(fetch).toHaveBeenCalledWith('https://api.resend.com/emails', expect.any(Object));
    });

    it('should handle global circuit breaker alerts', async () => {
      const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
      (fetch as any).mockResolvedValue(mockResponse);

      await alertCircuitBreakerOpen('fudo', null, 15);

      expect(fetch).toHaveBeenCalledTimes(2);
      
      // Check that the message indicates global scope
      const slackCall = (fetch as any).mock.calls.find((call: any) => 
        call[0] === 'https://hooks.slack.com/test'
      );
      const slackBody = JSON.parse(slackCall[1].body);
      expect(slackBody.text).toContain('Global circuit breaker');
    });
  });

  describe('alertRotationFailures', () => {
    it('should send rotation failure alerts with metadata', async () => {
      const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
      (fetch as any).mockResolvedValue(mockResponse);

      await alertRotationFailures('fudo', 'loc-123', 3, 'rot-456', 'Token expired');

      expect(fetch).toHaveBeenCalledTimes(2);
      
      // Check that metadata is included
      const emailCall = (fetch as any).mock.calls.find((call: any) => 
        call[0] === 'https://api.resend.com/emails'
      );
      const emailBody = JSON.parse(emailCall[1].body);
      expect(emailBody.html).toContain('rot-456');
      expect(emailBody.html).toContain('Token expired');
    });
  });

  describe('alertHealthcheckFailed', () => {
    it('should send healthcheck failure alerts', async () => {
      const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
      (fetch as any).mockResolvedValue(mockResponse);

      await alertHealthcheckFailed('fudo_rotation', 25.5, 'unhealthy', { last_error: 'Connection timeout' });

      expect(fetch).toHaveBeenCalledTimes(2);
      
      // Check severity based on hours overdue
      const slackCall = (fetch as any).mock.calls.find((call: any) => 
        call[0] === 'https://hooks.slack.com/test'
      );
      const slackBody = JSON.parse(slackCall[1].body);
      expect(slackBody.text).toContain('🔥'); // Critical severity for >24h
    });

    it('should use error severity for <24h overdue', async () => {
      const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
      (fetch as any).mockResolvedValue(mockResponse);

      await alertHealthcheckFailed('test_job', 12.5, 'failed');

      const slackCall = (fetch as any).mock.calls.find((call: any) => 
        call[0] === 'https://hooks.slack.com/test'
      );
      const slackBody = JSON.parse(slackCall[1].body);
      expect(slackBody.text).toContain('🚨'); // Error severity for <24h
    });
  });
});