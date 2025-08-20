import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createSupabaseMock, mockCircuitBreakerState, mockLeasedCredentials } from "./mocks/supabase.mock";
import { createFudoApiMocks } from "./mocks/fudo-api.mock";
import { createCryptoMocks, createDenoEnvMock } from "./mocks/crypto.mock";

// Mock modules
vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({
  serve: vi.fn(),
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2.54.0", () => ({
  createClient: vi.fn(),
}));

vi.mock("../../../supabase/functions/_shared/cors.ts", () => ({
  withCORS: vi.fn((handler) => handler),
}));

describe("Fudo Rotate Token - execute_atomic_rotation Conditions", () => {
  const supabaseMocks = createSupabaseMock();
  const fudoApiMocks = createFudoApiMocks();
  const cryptoMocks = createCryptoMocks();
  const denoEnvMock = createDenoEnvMock();

  let handler: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00.000Z'));
    cryptoMocks.activate();
    denoEnvMock.activate();
    fudoApiMocks.activate();

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.54.0");
    (createClient as any).mockReturnValue(supabaseMocks.supabaseMock);

    const module = await import("../../../supabase/functions/fudo-rotate-token/index.ts");
    handler = module.handler;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    cryptoMocks.restore();
    denoEnvMock.restore();
    fudoApiMocks.restore();
  });

  it("should NOT call execute_atomic_rotation when token renewal fails", async () => {
    supabaseMocks.rpcMock
      .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
      .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
      .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
      // No atomic rotation call expected
      .mockResolvedValueOnce({ data: null, error: null }) // record failure metric
      .mockResolvedValueOnce({ data: null, error: null }) // record job summary
      .mockResolvedValueOnce({ data: null, error: null }); // update heartbeat

    // Fail token renewal
    fudoApiMocks.setupTokenFailure(401);

    const request = new Request("http://localhost", { method: "POST" });
    const response = await handler(request);
    
    expect(response.status).toBe(200);
    const result = await response.json();
    
    expect(result.failures).toBe(1);
    expect(result.successes).toBe(0);

    // Verify execute_atomic_rotation was NEVER called
    const atomicCalls = supabaseMocks.rpcMock.mock.calls.filter(
      call => call[0] === "execute_atomic_rotation"
    );
    expect(atomicCalls).toHaveLength(0);

    // Verify fudoValidateToken (/me) was NEVER called
    const meCalls = fudoApiMocks.mockFetch.mock.calls.filter(
      call => call[0].includes("/me")
    );
    expect(meCalls).toHaveLength(0);
  });

  it("should NOT call execute_atomic_rotation when token validation (/me) fails", async () => {
    supabaseMocks.rpcMock
      .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
      .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
      .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
      // No atomic rotation call expected  
      .mockResolvedValueOnce({ data: null, error: null }) // record failure metric
      .mockResolvedValueOnce({ data: null, error: null }) // record job summary
      .mockResolvedValueOnce({ data: null, error: null }); // update heartbeat

    // Succeed token renewal, but fail validation
    fudoApiMocks.setupValidationFailure(403);

    const request = new Request("http://localhost", { method: "POST" });
    const response = await handler(request);
    
    expect(response.status).toBe(200);
    const result = await response.json();
    
    expect(result.failures).toBe(1);
    expect(result.successes).toBe(0);

    // Verify execute_atomic_rotation was NEVER called
    const atomicCalls = supabaseMocks.rpcMock.mock.calls.filter(
      call => call[0] === "execute_atomic_rotation"
    );
    expect(atomicCalls).toHaveLength(0);

    // Verify token was obtained but validation failed
    expect(fudoApiMocks.mockFetch).toHaveBeenCalledTimes(2); // token + /me attempt
    expect(fudoApiMocks.mockFetch).toHaveBeenNthCalledWith(1, 
      expect.stringContaining("/auth/token"), 
      expect.any(Object)
    );
    expect(fudoApiMocks.mockFetch).toHaveBeenNthCalledWith(2, 
      expect.stringContaining("/me"), 
      expect.any(Object)
    );
  });

  it("should ONLY call execute_atomic_rotation when both renewal AND validation succeed", async () => {
    supabaseMocks.rpcMock
      .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
      .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
      .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
      .mockResolvedValueOnce({ // execute_atomic_rotation success
        data: { 
          success: true, 
          is_idempotent: false,
          old_token_fingerprint: "sha256:old123...",
          new_token_fingerprint: "sha256:new456..."
        }, 
        error: null 
      })
      .mockResolvedValueOnce({ data: null, error: null }) // record success metric
      .mockResolvedValueOnce({ data: null, error: null }) // record job summary
      .mockResolvedValueOnce({ data: null, error: null }); // update heartbeat

    // Both token renewal and validation succeed
    fudoApiMocks.setupSuccessfulFlow();

    const request = new Request("http://localhost", { method: "POST" });
    const response = await handler(request);
    
    expect(response.status).toBe(200);
    const result = await response.json();
    
    expect(result.successes).toBe(1);
    expect(result.failures).toBe(0);

    // Verify execute_atomic_rotation was called exactly once
    const atomicCalls = supabaseMocks.rpcMock.mock.calls.filter(
      call => call[0] === "execute_atomic_rotation"
    );
    expect(atomicCalls).toHaveLength(1);

    // Verify the atomic call has the new token
    const atomicCall = atomicCalls[0];
    expect(atomicCall[1]).toMatchObject({
      location_id: expect.any(String),
      new_encrypted_token: expect.any(String),
      rotation_id: expect.any(String)
    });

    // Verify both Fudo API calls were made
    expect(fudoApiMocks.mockFetch).toHaveBeenCalledTimes(2);
    expect(fudoApiMocks.mockFetch).toHaveBeenNthCalledWith(1, 
      expect.stringContaining("/auth/token"), 
      expect.any(Object)
    );
    expect(fudoApiMocks.mockFetch).toHaveBeenNthCalledWith(2, 
      expect.stringContaining("/me"), 
      expect.any(Object)
    );
  });

  it("should verify operation sequence: decrypt → get_token → validate → swap", async () => {
    let callSequence: string[] = [];
    
    // Track the sequence of operations
    const originalRpc = supabaseMocks.rpcMock;
    supabaseMocks.rpcMock.mockImplementation((functionName, params) => {
      if (functionName === "execute_atomic_rotation") {
        callSequence.push("atomic_swap");
      }
      return originalRpc(functionName, params);
    });

    const originalFetch = fudoApiMocks.mockFetch;
    fudoApiMocks.mockFetch.mockImplementation((url, options) => {
      if (url.includes("/auth/token")) {
        callSequence.push("get_token");
      } else if (url.includes("/me")) {
        callSequence.push("validate_token");
      }
      return originalFetch(url, options);
    });

    supabaseMocks.rpcMock
      .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
      .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
      .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
      .mockResolvedValueOnce({ 
        data: { success: true, is_idempotent: false }, 
        error: null 
      })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    fudoApiMocks.setupSuccessfulFlow();

    const request = new Request("http://localhost", { method: "POST" });
    await handler(request);

    // Verify correct sequence: decrypt happens first (implicitly during candidate processing)
    // Then get_token → validate_token → atomic_swap
    expect(callSequence).toEqual(["get_token", "validate_token", "atomic_swap"]);
  });
});