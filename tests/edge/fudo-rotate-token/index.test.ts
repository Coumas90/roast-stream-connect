import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createSupabaseMock, mockCircuitBreakerState, mockLeasedCredentials, mockAtomicRotationSuccess, mockAtomicRotationError } from "./mocks/supabase.mock";
import { createFudoApiMocks } from "./mocks/fudo-api.mock";
import { createCryptoMocks, createDenoEnvMock } from "./mocks/crypto.mock";

// Mock the imports before importing the handler
vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({
  serve: vi.fn(),
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2.54.0", () => ({
  createClient: vi.fn(),
}));

vi.mock("../../../supabase/functions/_shared/cors.ts", () => ({
  withCORS: vi.fn((handler) => handler),
}));

describe("Fudo Rotate Token - Main Handler", () => {
  const supabaseMocks = createSupabaseMock();
  const fudoApiMocks = createFudoApiMocks();
  const cryptoMocks = createCryptoMocks();
  const denoEnvMock = createDenoEnvMock();

  let handler: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    // Setup all mocks
    cryptoMocks.activate();
    denoEnvMock.activate();
    fudoApiMocks.activate();

    // Mock createClient to return our mock
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.54.0");
    (createClient as any).mockReturnValue(supabaseMocks.supabaseMock);

    // Import handler after mocks are set up
    const module = await import("../../../supabase/functions/fudo-rotate-token/index.ts");
    handler = module.handler;
  });

  afterEach(() => {
    vi.resetAllMocks();
    cryptoMocks.restore();
    denoEnvMock.restore();
    fudoApiMocks.restore();
    supabaseMocks.resetMocks();
  });

  describe("Scenario 1: Success - Complete Flow (renueva + ping + swap)", () => {
    it("should execute successful token rotation with all steps", async () => {
      // Setup mocks for successful scenario
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ // cb_check_state (global)
          data: mockCircuitBreakerState("closed"),
          error: null,
        })
        .mockResolvedValueOnce({ // lease_fudo_rotation_candidates
          data: mockLeasedCredentials(1),
          error: null,
        })
        .mockResolvedValueOnce({ // cb_check_state (location)
          data: mockCircuitBreakerState("closed"),
          error: null,
        })
        .mockResolvedValueOnce(mockAtomicRotationSuccess()) // execute_atomic_rotation
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_success (global)
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_success (location)
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (job summary)
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (attempt)
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      fudoApiMocks.setupSuccessfulFlow();

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.result.successes).toBe(1);
      expect(result.result.failures).toBe(0);
      expect(result.result.idempotent_hits).toBe(0);

      // Verify the complete flow was executed
      expect(fudoApiMocks.mockFetch).toHaveBeenCalledTimes(2); // token + validation
      expect(supabaseMocks.rpcMock).toHaveBeenCalledWith("execute_atomic_rotation", expect.any(Object));
      expect(supabaseMocks.rpcMock).toHaveBeenCalledWith("cb_record_success", expect.any(Object));
    });
  });

  describe("Scenario 2: Failure in Token Renewal (no swap)", () => {
    it("should fail at token renewal and not proceed to validation or swap", async () => {
      // Setup mocks for token renewal failure
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ // cb_check_state (global)
          data: mockCircuitBreakerState("closed"),
          error: null,
        })
        .mockResolvedValueOnce({ // lease_fudo_rotation_candidates
          data: mockLeasedCredentials(1),
          error: null,
        })
        .mockResolvedValueOnce({ // cb_check_state (location)
          data: mockCircuitBreakerState("closed"),
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_failure (global)
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_failure (location)
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (job summary)
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      fudoApiMocks.setupTokenFailure(500); // 5xx error should increment breaker

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(false); // failures > 0
      expect(result.result.successes).toBe(0);
      expect(result.result.failures).toBe(1);

      // Verify token renewal was attempted but validation and swap were not
      expect(fudoApiMocks.mockFetch).toHaveBeenCalledTimes(1); // Only token call
      expect(supabaseMocks.rpcMock).not.toHaveBeenCalledWith("execute_atomic_rotation", expect.any(Object));
      expect(supabaseMocks.rpcMock).toHaveBeenCalledWith("cb_record_failure", expect.any(Object));
    });

    it("should not increment circuit breaker for 401 auth errors", async () => {
      // Setup mocks for auth failure (should not increment breaker)
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ // cb_check_state (global)
          data: mockCircuitBreakerState("closed"),
          error: null,
        })
        .mockResolvedValueOnce({ // lease_fudo_rotation_candidates
          data: mockLeasedCredentials(1),
          error: null,
        })
        .mockResolvedValueOnce({ // cb_check_state (location)
          data: mockCircuitBreakerState("closed"),
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (job summary)
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      fudoApiMocks.setupTokenFailure(401); // Auth error - should NOT increment breaker

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.result.failures).toBe(1);
      // Should NOT call cb_record_failure for auth errors
      expect(supabaseMocks.rpcMock).not.toHaveBeenCalledWith("cb_record_failure", expect.any(Object));
    });
  });

  describe("Scenario 3: Failure in Validation/Ping (no swap)", () => {
    it("should fail at token validation and not proceed to swap", async () => {
      // Setup mocks for validation failure
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ // cb_check_state (global)
          data: mockCircuitBreakerState("closed"),
          error: null,
        })
        .mockResolvedValueOnce({ // lease_fudo_rotation_candidates
          data: mockLeasedCredentials(1),
          error: null,
        })
        .mockResolvedValueOnce({ // cb_check_state (location)
          data: mockCircuitBreakerState("closed"),
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (job summary)
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      fudoApiMocks.setupValidationFailure(403); // Validation fails

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.result.successes).toBe(0);
      expect(result.result.failures).toBe(1);

      // Verify token was obtained but validation failed and swap was not attempted
      expect(fudoApiMocks.mockFetch).toHaveBeenCalledTimes(2); // token + validation
      expect(supabaseMocks.rpcMock).not.toHaveBeenCalledWith("execute_atomic_rotation", expect.any(Object));
    });
  });

  describe("Scenario 4: Circuit Breaker Opens (≥10 failures/15 min)", () => {
    it("should respect open circuit breaker and skip rotation", async () => {
      // Setup circuit breaker in open state
      supabaseMocks.rpcMock.mockResolvedValueOnce({
        data: mockCircuitBreakerState("open", false),
        error: null,
      });

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(response.status).toBe(503);
      expect(result.success).toBe(false);
      expect(result.message).toContain("Global circuit breaker is open");
      expect(result.circuit_breaker.state).toBe("open");

      // Should not proceed to lease candidates
      expect(supabaseMocks.rpcMock).not.toHaveBeenCalledWith("lease_fudo_rotation_candidates", expect.any(Object));
    });

    it("should process only 1 location in half-open mode", async () => {
      // Setup circuit breaker in half-open state
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({
          data: mockCircuitBreakerState("half-open", true, true), // test_mode = true
          error: null,
        })
        .mockResolvedValueOnce({ // lease_fudo_rotation_candidates
          data: mockLeasedCredentials(3), // 3 candidates available
          error: null,
        })
        .mockResolvedValueOnce({ // cb_check_state (location)
          data: mockCircuitBreakerState("closed"),
          error: null,
        })
        .mockResolvedValueOnce(mockAtomicRotationSuccess()) // execute_atomic_rotation
        .mockResolvedValueOnce({ data: { state: "closed" }, error: null }) // cb_record_success (global) - transition to closed
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_success (location)
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (job summary)
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (attempt)
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      fudoApiMocks.setupSuccessfulFlow();

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.result.processed).toBe(1); // Only 1 location processed in test mode
      expect(result.result.successes).toBe(1);
    });
  });

  describe("Scenario 5: Idempotency (evita doble swap)", () => {
    it("should detect idempotent rotation and skip duplicate processing", async () => {
      // Setup mocks for idempotent scenario
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ // cb_check_state (global)
          data: mockCircuitBreakerState("closed"),
          error: null,
        })
        .mockResolvedValueOnce({ // lease_fudo_rotation_candidates
          data: mockLeasedCredentials(1),
          error: null,
        })
        .mockResolvedValueOnce({ // cb_check_state (location)
          data: mockCircuitBreakerState("closed"),
          error: null,
        })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(true)) // execute_atomic_rotation - idempotent
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (job summary)
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      fudoApiMocks.setupSuccessfulFlow();

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.result.successes).toBe(0);
      expect(result.result.failures).toBe(0);
      expect(result.result.idempotent_hits).toBe(1);

      // Should NOT record success metrics for idempotent hits
      expect(supabaseMocks.rpcMock).not.toHaveBeenCalledWith("cb_record_success", expect.any(Object));
      
      // Should NOT record individual attempt metrics for idempotent hits
      const recordMetricCalls = supabaseMocks.rpcMock.mock.calls.filter(
        call => call[0] === "record_rotation_metric" && call[1].p_metric_type === "rotation_attempt"
      );
      expect(recordMetricCalls).toHaveLength(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle database connection errors gracefully", async () => {
      supabaseMocks.rpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Database connection failed" },
      });

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Circuit breaker check failed");
    });

    it("should handle network timeouts in Fudo API calls", async () => {
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_failure
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_failure
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      fudoApiMocks.setupNetworkError();

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.result.failures).toBe(1);
      expect(supabaseMocks.rpcMock).toHaveBeenCalledWith("cb_record_failure", expect.any(Object));
    });
  });

  describe("OPTIONS Request Handling", () => {
    it("should handle CORS preflight requests", async () => {
      const request = new Request("http://localhost", { method: "OPTIONS" });
      const response = await handler(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });
});