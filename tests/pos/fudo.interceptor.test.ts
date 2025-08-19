import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DefaultFudoClient } from "../../src/integrations/pos/fudo/client";
import type { POSConfig } from "../../sdk/pos";
import { fudoMetrics } from "../../src/integrations/pos/fudo/metrics";

// Mock Supabase
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    insert: vi.fn()
  }))
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase
}));

// Mock metrics
vi.mock("../../src/integrations/pos/fudo/metrics", () => ({
  fudoMetrics: {
    increment: vi.fn().mockResolvedValue(undefined)
  }
}));

describe("Fudo Interceptor 401 + Retry", () => {
  let client: DefaultFudoClient;
  let config: POSConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      provider: "fudo",
      apiKey: "test-key",
      locationId: "loc-123"
    };
    client = new DefaultFudoClient(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should handle expired 401 and rotate token once", async () => {
    // Mock circuit breaker as closed (allows rotation)
    mockSupabase.rpc.mockImplementation((fn, params) => {
      if (fn === 'cb_check_state') {
        return Promise.resolve({ data: { allowed: true }, error: null });
      }
      if (fn === 'execute_atomic_rotation') {
        return Promise.resolve({ 
          data: [{ operation_result: 'rotated', is_idempotent: false }], 
          error: null 
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    let callCount = 0;
    const mockFetchSales = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        // First call: throw 401 expired token error
        const error: any = new Error('Token expired');
        error.status = 401;
        error.code = 'TOKEN_EXPIRED';
        throw error;
      }
      // Second call: success after rotation
      return { data: [{ id: "sale1", total: 10 }], nextCursor: undefined };
    });

    // Replace the actual fetchSales implementation
    (client as any).callWithRetry = async function<T>(
      operation: () => Promise<T>,
      context: { operation: string; params?: any; didRetry?: boolean }
    ): Promise<T> {
      if (context.operation === 'fetchSales') {
        return mockFetchSales() as T;
      }
      return operation();
    };

    const result = await client.fetchSales({ from: "2024-01-01", to: "2024-01-02" });

    expect(result).toEqual({ data: [{ id: "sale1", total: 10 }], nextCursor: undefined });
    expect(callCount).toBe(2); // First call fails, second succeeds
    expect(mockSupabase.rpc).toHaveBeenCalledWith('cb_check_state', {
      _provider: 'fudo',
      _location_id: 'loc-123'
    });
    expect(mockSupabase.rpc).toHaveBeenCalledWith('execute_atomic_rotation', expect.objectContaining({
      p_location_id: 'loc-123',
      p_provider: 'fudo'
    }));
  });

  it("should not retry for permission errors (403)", async () => {
    let callCount = 0;
    const mockOperation = vi.fn(async () => {
      callCount++;
      const error: any = new Error('Insufficient permissions');
      error.status = 403;
      throw error;
    });

    // Access the private method for testing
    const callWithRetry = (client as any).callWithRetry.bind(client);

    await expect(callWithRetry(mockOperation, { operation: 'test' })).rejects.toThrow('Insufficient permissions');
    expect(callCount).toBe(1); // Should not retry
    expect(mockSupabase.rpc).not.toHaveBeenCalled(); // No rotation attempted
  });

  it("should not retry when circuit breaker is open", async () => {
    // Mock circuit breaker as open (blocks rotation)
    mockSupabase.rpc.mockImplementation((fn) => {
      if (fn === 'cb_check_state') {
        return Promise.resolve({ data: { allowed: false, state: 'open' }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    let callCount = 0;
    const mockOperation = vi.fn(async () => {
      callCount++;
      const error: any = new Error('Token expired');
      error.status = 401;
      error.code = 'TOKEN_EXPIRED';
      throw error;
    });

    const callWithRetry = (client as any).callWithRetry.bind(client);

    await expect(callWithRetry(mockOperation, { operation: 'test' })).rejects.toThrow('Circuit breaker open');
    expect(callCount).toBe(1); // Should not retry
    expect(fudoMetrics.increment).toHaveBeenCalledWith('fudo.401_failed_circuit_open', expect.any(Object));
  });

  it("should only attempt rotation once per location (deduplication)", async () => {
    // Mock circuit breaker as closed
    mockSupabase.rpc.mockImplementation((fn) => {
      if (fn === 'cb_check_state') {
        return Promise.resolve({ data: { allowed: true }, error: null });
      }
      if (fn === 'execute_atomic_rotation') {
        // Simulate slow rotation
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ data: [{ operation_result: 'rotated' }], error: null });
          }, 100);
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const mockOperation = vi.fn(async () => {
      const error: any = new Error('Token expired');
      error.status = 401;
      error.code = 'TOKEN_EXPIRED';
      throw error;
    });

    const callWithRetry = (client as any).callWithRetry.bind(client);

    // Start two concurrent operations that both encounter 401
    const promises = [
      callWithRetry(mockOperation, { operation: 'test1' }).catch(() => 'failed1'),
      callWithRetry(mockOperation, { operation: 'test2' }).catch(() => 'failed2')
    ];

    await Promise.all(promises);

    // Should only call execute_atomic_rotation once due to deduplication
    const rotationCalls = mockSupabase.rpc.mock.calls.filter(call => call[0] === 'execute_atomic_rotation');
    expect(rotationCalls.length).toBe(1);
  });

  it("should log comprehensive metrics for all scenarios", async () => {
    // Mock circuit breaker as closed
    mockSupabase.rpc.mockImplementation((fn) => {
      if (fn === 'cb_check_state') {
        return Promise.resolve({ data: { allowed: true }, error: null });
      }
      if (fn === 'execute_atomic_rotation') {
        return Promise.resolve({ data: [{ operation_result: 'rotated' }], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    let callCount = 0;
    const mockOperation = vi.fn(async () => {
      callCount++;
      if (callCount <= 2) {
        // Both calls fail to test failed_after_retry
        const error: any = new Error('Token expired');
        error.status = 401;
        error.code = 'TOKEN_EXPIRED';
        throw error;
      }
      return "success";
    });

    const callWithRetry = (client as any).callWithRetry.bind(client);

    await expect(callWithRetry(mockOperation, { operation: 'test' })).rejects.toThrow();

    // Verify metrics were logged
    expect(fudoMetrics.increment).toHaveBeenCalledWith('fudo.401_total', expect.objectContaining({
      location_id: 'loc-123',
      operation: 'test'
    }));
    expect(fudoMetrics.increment).toHaveBeenCalledWith('fudo.401_failed_after_retry', expect.objectContaining({
      location_id: 'loc-123',
      operation: 'test'
    }));
  });
});