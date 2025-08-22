import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DefaultFudoClient } from "../../src/integrations/pos/fudo/client";
import type { POSConfig } from "../../sdk/pos";

// Mock Supabase client
const mockSupabaseRpc = vi.fn();
const mockSupabaseFunctions = {
  invoke: vi.fn()
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mockSupabaseRpc,
    functions: mockSupabaseFunctions
  }
}));

// Mock fudoMetrics
const mockFudoMetrics = {
  increment: vi.fn().mockResolvedValue(undefined)
};

vi.mock("../../src/integrations/pos/fudo/metrics", () => ({
  fudoMetrics: mockFudoMetrics
}));

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-rotation-id-123'
  },
  writable: true
});

describe("Fudo Interceptor 401 + Retry", () => {
  let client: DefaultFudoClient;
  let config: POSConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      provider: "fudo",
      apiKey: "test-key",
      locationId: "test-location"
    };
    client = new DefaultFudoClient(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should handle expired 401 and rotate token once", async () => {
    // Setup: circuit breaker allows rotation
    mockSupabaseRpc.mockResolvedValueOnce({
      data: { allowed: true },
      error: null
    });

    // Setup: rotation endpoint succeeds
    mockSupabaseFunctions.invoke.mockResolvedValueOnce({
      data: { operation_result: 'rotated', rows_affected: 1, token_id: 'test-id' },
      error: null
    });

    // Create client that will throw 401 first, then succeed
    let callCount = 0;
    const mockOperation = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const error: any = new Error('Token expired');
        error.status = 401;
        error.code = 'TOKEN_EXPIRED';
        throw error;
      }
      return { data: ['success'] };
    });

    // Access the private method for testing
    const callWithRetry = (client as any).callWithRetry.bind(client);
    const result = await callWithRetry(mockOperation, { operation: 'fetchSales' });

    expect(result).toEqual({ data: ['success'] });
    expect(mockOperation).toHaveBeenCalledTimes(2);
    
    // Verify circuit breaker was checked
    expect(mockSupabaseRpc).toHaveBeenCalledWith('cb_check_state', {
      _provider: 'fudo',
      _location_id: 'test-location'
    });

    // Verify rotation endpoint was called correctly
    expect(mockSupabaseFunctions.invoke).toHaveBeenCalledWith('pos-credentials-rotation', {
      body: {
        location_id: 'test-location',
        provider: 'fudo',
        rotation_id: 'test-rotation-id-123',
        mode: 'single-location'
      },
      signal: expect.any(AbortSignal)
    });

    // Verify metrics include proper attributes
    expect(mockFudoMetrics.increment).toHaveBeenCalledWith('fudo.401_total', {
      location_id: 'test-location',
      operation: 'fetchSales',
      didRetry: false,
      reason: 'token_expired'
    });

    expect(mockFudoMetrics.increment).toHaveBeenCalledWith('fudo.rotate_ondemand_success', {
      location_id: 'test-location',
      rotation_id: 'test-rotation-id-123',
      duration_ms: expect.any(Number),
      idempotent: false,
      didRetry: false
    });

    expect(mockFudoMetrics.increment).toHaveBeenCalledWith('fudo.401_recovered', {
      location_id: 'test-location',
      operation: 'fetchSales',
      didRetry: true
    });
  });

  it("should not retry for permission errors (403)", async () => {
    const mockOperation = vi.fn().mockImplementation(() => {
      const error: any = new Error('Insufficient permissions');
      error.status = 403;
      error.code = 'FORBIDDEN';
      throw error;
    });

    const callWithRetry = (client as any).callWithRetry.bind(client);
    await expect(callWithRetry(mockOperation, { operation: 'fetchSales' }))
      .rejects.toThrow('Insufficient permissions for this operation');

    expect(mockOperation).toHaveBeenCalledTimes(1);
    expect(mockSupabaseRpc).not.toHaveBeenCalled();
    expect(mockSupabaseFunctions.invoke).not.toHaveBeenCalled();
    expect(mockFudoMetrics.increment).not.toHaveBeenCalledWith('fudo.401_total', expect.any(Object));
  });

  it("should handle 401 permission errors without rotation", async () => {
    const mockOperation = vi.fn().mockImplementation(() => {
      const error: any = new Error('Access denied to tenant');
      error.status = 401;
      error.code = 'ACCESS_DENIED';
      throw error;
    });

    const callWithRetry = (client as any).callWithRetry.bind(client);
    await expect(callWithRetry(mockOperation, { operation: 'fetchSales' }))
      .rejects.toThrow('Authentication failed');

    expect(mockOperation).toHaveBeenCalledTimes(1);
    expect(mockSupabaseRpc).not.toHaveBeenCalled();
    expect(mockSupabaseFunctions.invoke).not.toHaveBeenCalled();
    
    // Should log permission error metric
    expect(mockFudoMetrics.increment).toHaveBeenCalledWith('fudo.401_permission_error', {
      location_id: 'test-location',
      operation: 'fetchSales',
      error_status: 401,
      error_code: 'ACCESS_DENIED',
      didRetry: false,
      reason: 'permission_denied'
    });
  });

  it("should not retry when circuit breaker is open", async () => {
    // Setup: circuit breaker blocks rotation
    mockSupabaseRpc.mockResolvedValueOnce({
      data: { allowed: false, state: 'open' },
      error: null
    });

    const mockOperation = vi.fn().mockImplementation(() => {
      const error: any = new Error('Token expired');
      error.status = 401;
      error.code = 'TOKEN_EXPIRED';
      throw error;
    });

    const callWithRetry = (client as any).callWithRetry.bind(client);
    await expect(callWithRetry(mockOperation, { operation: 'fetchSales' }))
      .rejects.toThrow('Circuit breaker open, rotation blocked');

    expect(mockOperation).toHaveBeenCalledTimes(1);
    expect(mockSupabaseFunctions.invoke).not.toHaveBeenCalled();
    
    expect(mockFudoMetrics.increment).toHaveBeenCalledWith('fudo.401_failed_circuit_open', {
      location_id: 'test-location',
      operation: 'fetchSales',
      didRetry: false,
      reason: 'circuit_breaker_open'
    });
  });

  it("should only attempt rotation once per location (deduplication)", async () => {
    // Setup: circuit breaker allows rotation
    mockSupabaseRpc.mockResolvedValue({
      data: { allowed: true },
      error: null
    });

    // Setup: rotation endpoint succeeds (called only once due to deduplication)
    mockSupabaseFunctions.invoke.mockResolvedValue({
      data: { operation_result: 'rotated', rows_affected: 1, token_id: 'test-id' },
      error: null
    });

    let callCount = 0;
    const mockOperation = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) { // First two calls fail with 401
        const error: any = new Error('Token expired');
        error.status = 401;
        error.code = 'TOKEN_EXPIRED';
        throw error;
      }
      return { data: ['success'] };
    });

    // Make two concurrent requests
    const callWithRetry = (client as any).callWithRetry.bind(client);
    const [result1, result2] = await Promise.all([
      callWithRetry(mockOperation, { operation: 'fetchSales' }),
      callWithRetry(mockOperation, { operation: 'fetchSales' })
    ]);

    expect(result1).toEqual({ data: ['success'] });
    expect(result2).toEqual({ data: ['success'] });
    
    // Should only call rotation endpoint once even with concurrent 401s
    expect(mockSupabaseFunctions.invoke).toHaveBeenCalledTimes(1);
    expect(mockSupabaseFunctions.invoke).toHaveBeenCalledWith('pos-credentials-rotation', expect.objectContaining({
      body: expect.objectContaining({
        location_id: 'test-location',
        provider: 'fudo',
        mode: 'single-location'
      })
    }));
  });

  it("should handle rotation timeout and open circuit breaker", async () => {
    // Setup: circuit breaker allows rotation initially
    mockSupabaseRpc.mockResolvedValueOnce({
      data: { allowed: true },
      error: null
    });

    // Setup: rotation endpoint times out
    mockSupabaseFunctions.invoke.mockRejectedValueOnce(new Error('Request timeout'));

    const mockOperation = vi.fn().mockImplementation(() => {
      const error: any = new Error('Token expired');
      error.status = 401;
      error.code = 'TOKEN_EXPIRED';
      throw error;
    });

    const callWithRetry = (client as any).callWithRetry.bind(client);
    await expect(callWithRetry(mockOperation, { operation: 'fetchSales' }))
      .rejects.toThrow('Token rotation failed');

    expect(mockOperation).toHaveBeenCalledTimes(1);
    
    // Verify failure metrics
    expect(mockFudoMetrics.increment).toHaveBeenCalledWith('fudo.rotate_ondemand_failed', {
      location_id: 'test-location',
      rotation_id: 'test-rotation-id-123',
      duration_ms: expect.any(Number),
      error: 'Token rotation failed: Request timeout',
      didRetry: false
    });
  });

  it("should open circuit breaker on second 401 failure", async () => {
    // Setup: circuit breaker allows rotation
    mockSupabaseRpc.mockResolvedValueOnce({
      data: { allowed: true },
      error: null
    });

    // Setup: rotation succeeds but second attempt still fails
    mockSupabaseFunctions.invoke.mockResolvedValueOnce({
      data: { operation_result: 'rotated', rows_affected: 1, token_id: 'test-id' },
      error: null
    });

    // Setup: circuit breaker failure recording
    mockSupabaseRpc.mockResolvedValueOnce({
      data: { state: 'open' },
      error: null
    });

    const mockOperation = vi.fn().mockImplementation(() => {
      const error: any = new Error('Token expired');
      error.status = 401;
      error.code = 'TOKEN_EXPIRED';
      throw error;
    });

    const callWithRetry = (client as any).callWithRetry.bind(client);
    await expect(callWithRetry(mockOperation, { operation: 'fetchSales' }))
      .rejects.toThrow('Authentication failed');

    // Verify circuit breaker failure was recorded after second 401
    expect(mockSupabaseRpc).toHaveBeenCalledWith('cb_record_failure', {
      _provider: 'fudo',
      _location_id: 'test-location'
    });

    // Verify second failure metrics
    expect(mockFudoMetrics.increment).toHaveBeenCalledWith('fudo.401_failed_after_retry', {
      location_id: 'test-location',
      operation: 'fetchSales',
      error_status: 401,
      error_code: 'TOKEN_EXPIRED',
      didRetry: true,
      reason: 'still_expired_after_rotation'
    });
  });

  it("should log comprehensive metrics for all scenarios", async () => {
    // Test successful recovery
    mockSupabaseRpc.mockResolvedValueOnce({ data: { allowed: true }, error: null });
    mockSupabaseFunctions.invoke.mockResolvedValueOnce({
      data: { operation_result: 'rotated', rows_affected: 1, token_id: 'test-id' },
      error: null
    });

    let callCount = 0;
    const mockOperation = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const error: any = new Error('Token expired');
        error.status = 401;
        error.code = 'TOKEN_EXPIRED';
        throw error;
      }
      return { data: ['success'] };
    });

    const callWithRetry = (client as any).callWithRetry.bind(client);
    await callWithRetry(mockOperation, { operation: 'fetchSales' });

    // Verify comprehensive metrics were logged with proper attributes
    expect(mockFudoMetrics.increment).toHaveBeenCalledWith('fudo.401_total', {
      location_id: 'test-location',
      operation: 'fetchSales',
      didRetry: false,
      reason: 'token_expired'
    });
    
    expect(mockFudoMetrics.increment).toHaveBeenCalledWith('fudo.rotate_ondemand_attempt', {
      location_id: 'test-location',
      rotation_id: 'test-rotation-id-123'
    });
    
    expect(mockFudoMetrics.increment).toHaveBeenCalledWith('fudo.401_recovered_attempt', {
      location_id: 'test-location',
      operation: 'fetchSales',
      rotation_id: 'test-rotation-id-123',
      didRetry: false
    });
    
    expect(mockFudoMetrics.increment).toHaveBeenCalledWith('fudo.rotate_ondemand_success', {
      location_id: 'test-location',
      rotation_id: 'test-rotation-id-123',
      duration_ms: expect.any(Number),
      idempotent: false,
      didRetry: false
    });
  });

  // ========== CARD #16: TOKEN ZOMBIE UAT TESTS ==========
  
  describe("Token Zombie UAT", () => {
    it("old token returns 401 <100ms with 0 retries", async () => {
      // Simulate post-rotation scenario where old token is now invalid
      const mockOperationWithOldToken = vi.fn().mockImplementation(() => {
        const error: any = new Error('Token is invalid/expired');
        error.status = 401;
        error.code = 'INVALID_TOKEN';
        throw error;
      });

      const start = Date.now();
      const callWithRetry = (client as any).callWithRetry.bind(client);
      
      // Mock isExpired401 to return false for zombie tokens (not expired, just invalid)
      const isExpired401Spy = vi.spyOn(client as any, 'isExpired401').mockReturnValue(false);
      
      await expect(callWithRetry(mockOperationWithOldToken, { operation: 'fetchSales' }))
        .rejects.toThrow('Authentication failed');
      
      const latency = Date.now() - start;

      // Core UAT assertions
      expect(latency).toBeLessThan(100); // Response < 100ms
      expect(mockOperationWithOldToken).toHaveBeenCalledTimes(1); // No retries (0 additional calls)
      expect(mockSupabaseRpc).not.toHaveBeenCalled(); // No circuit breaker check
      expect(mockSupabaseFunctions.invoke).not.toHaveBeenCalled(); // No rotation attempt
      
      // Verify zombie token metrics
      expect(mockFudoMetrics.increment).toHaveBeenCalledWith('fudo.401_permission_error', {
        location_id: 'test-location',
        operation: 'fetchSales',
        error_status: 401,
        error_code: 'INVALID_TOKEN',
        didRetry: false,
        reason: 'permission_denied'
      });

      isExpired401Spy.mockRestore();
    });

    it("zombie token detection prevents unnecessary rotation attempts", async () => {
      // Simulate multiple clients using old (zombie) token simultaneously
      const mockZombieOperation = vi.fn().mockImplementation(() => {
        const error: any = new Error('Token revoked or invalid');
        error.status = 401;
        error.code = 'TOKEN_REVOKED';
        throw error;
      });

      const callWithRetry = (client as any).callWithRetry.bind(client);
      
      // Mock isExpired401 to correctly identify zombie tokens
      const isExpired401Spy = vi.spyOn(client as any, 'isExpired401').mockReturnValue(false);

      // Multiple concurrent requests with zombie token
      const promises = Array(5).fill(null).map(() => 
        callWithRetry(mockZombieOperation, { operation: 'fetchSales' }).catch(e => e)
      );

      const results = await Promise.all(promises);

      // All should fail immediately without rotation attempts
      results.forEach(result => {
        expect(result.message).toContain('Authentication failed');
      });

      // Verify no rotation attempts were made despite multiple 401s
      expect(mockSupabaseRpc).not.toHaveBeenCalled();
      expect(mockSupabaseFunctions.invoke).not.toHaveBeenCalled();
      expect(mockZombieOperation).toHaveBeenCalledTimes(5); // Each called once only

      isExpired401Spy.mockRestore();
    });

    it("performance regression test: 401 response time consistently <100ms", async () => {
      const trials = 10;
      const latencies: number[] = [];

      const mockFast401 = vi.fn().mockImplementation(() => {
        const error: any = new Error('Invalid credentials');
        error.status = 401;
        error.code = 'INVALID_CREDENTIALS';
        throw error;
      });

      const callWithRetry = (client as any).callWithRetry.bind(client);
      const isExpired401Spy = vi.spyOn(client as any, 'isExpired401').mockReturnValue(false);

      // Run multiple trials to test consistency
      for (let i = 0; i < trials; i++) {
        const start = Date.now();
        await callWithRetry(mockFast401, { operation: 'fetchSales' }).catch(() => {});
        const latency = Date.now() - start;
        latencies.push(latency);
      }

      // Statistical validation
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(trials * 0.95)];

      expect(avgLatency).toBeLessThan(50); // Average should be very fast
      expect(maxLatency).toBeLessThan(100); // No outliers > 100ms
      expect(p95Latency).toBeLessThan(75); // 95th percentile < 75ms

      isExpired401Spy.mockRestore();
    });
  });
});