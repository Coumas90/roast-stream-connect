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

describe("Fudo Rotate Token - Circuit Breaker Behavior", () => {
  const supabaseMocks = createSupabaseMock();
  const fudoApiMocks = createFudoApiMocks();
  const cryptoMocks = createCryptoMocks();
  const denoEnvMock = createDenoEnvMock();

  let handler: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    cryptoMocks.activate();
    denoEnvMock.activate();
    fudoApiMocks.activate();

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.54.0");
    (createClient as any).mockReturnValue(supabaseMocks.supabaseMock);

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

  describe("Circuit Breaker States", () => {
    it("should block all requests when circuit breaker is open", async () => {
      const openState = mockCircuitBreakerState("open", false);
      openState.resume_at = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // Resume in 1 hour

      supabaseMocks.rpcMock.mockResolvedValueOnce({
        data: openState,
        error: null,
      });

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(response.status).toBe(503);
      expect(result.success).toBe(false);
      expect(result.message).toContain("Global circuit breaker is open");
      expect(result.circuit_breaker.state).toBe("open");
      expect(result.resume_at).toBeDefined();

      // Should not proceed to lease candidates or process any locations
      expect(supabaseMocks.rpcMock).toHaveBeenCalledTimes(1); // Only circuit breaker check
    });

    it("should allow limited testing in half-open state", async () => {
      const halfOpenState = mockCircuitBreakerState("half-open", true, true);

      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: halfOpenState, error: null }) // Global CB check
        .mockResolvedValueOnce({ data: mockLeasedCredentials(5), error: null }) // 5 candidates
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null }) // Location CB
        .mockResolvedValueOnce({ // execute_atomic_rotation
          data: [{ operation_result: "token_updated", rows_affected: 1, token_id: "test", is_idempotent: false }],
          error: null,
        })
        .mockResolvedValueOnce({ data: { state: "closed" }, error: null }) // cb_record_success (global) - transitions to closed
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_success (location)
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      fudoApiMocks.setupSuccessfulFlow();

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.result.processed).toBe(1); // Only 1 location processed in test mode
      expect(result.result.total_candidates).toBe(5); // But 5 were available
    });

    it("should transition from half-open to closed on success", async () => {
      const halfOpenState = mockCircuitBreakerState("half-open", true, true);

      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: halfOpenState, error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({
          data: [{ operation_result: "token_updated", rows_affected: 1, token_id: "test", is_idempotent: false }],
          error: null,
        })
        .mockResolvedValueOnce({ data: { state: "closed", transition: "half-open -> closed" }, error: null }) // Success records transition
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      fudoApiMocks.setupSuccessfulFlow();

      const request = new Request("http://localhost", { method: "POST" });
      await handler(request);

      // Verify that cb_record_success was called for both global and location
      expect(supabaseMocks.rpcMock).toHaveBeenCalledWith("cb_record_success", {
        _provider: "fudo",
        _location_id: null, // Global
      });
    });

    it("should transition from half-open back to open on failure", async () => {
      const halfOpenState = mockCircuitBreakerState("half-open", true, true);

      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: halfOpenState, error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: { state: "open" }, error: null }) // Failure opens circuit
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      fudoApiMocks.setup5xxError(500); // 5xx error should increment breaker

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.result.failures).toBe(1);
      expect(supabaseMocks.rpcMock).toHaveBeenCalledWith("cb_record_failure", {
        _provider: "fudo",
        _location_id: null,
      });
    });
  });

  describe("Location-specific Circuit Breaker", () => {
    it("should block individual locations when their circuit breaker is open", async () => {
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed", true), error: null }) // Global CB - ok
        .mockResolvedValueOnce({ data: mockLeasedCredentials(2), error: null }) // 2 candidates
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("open", false), error: null }) // Location 1 - blocked
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed", true), error: null }) // Location 2 - ok
        .mockResolvedValueOnce({
          data: [{ operation_result: "token_updated", rows_affected: 1, token_id: "test", is_idempotent: false }],
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_success (global)
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_success (location)
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      fudoApiMocks.setupSuccessfulFlow();

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.result.processed).toBe(2);
      expect(result.result.successes).toBe(1); // Only location 2 succeeded
      expect(result.result.circuit_breaker_blocked).toBe(1); // Location 1 was blocked
    });
  });

  describe("Circuit Breaker Failure Counting", () => {
    it("should increment breaker only for network and 5xx errors", async () => {
      const testCases = [
        { status: 500, shouldIncrement: true, description: "5xx server error" },
        { status: 429, shouldIncrement: true, description: "rate limit" },
        { status: 401, shouldIncrement: false, description: "auth error" },
        { status: 403, shouldIncrement: false, description: "permission error" },
        { status: 400, shouldIncrement: false, description: "client error" },
      ];

      for (const testCase of testCases) {
        supabaseMocks.resetMocks();
        fudoApiMocks.mockFetch.mockReset();

        supabaseMocks.rpcMock
          .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
          .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
          .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null });

        if (testCase.shouldIncrement) {
          supabaseMocks.rpcMock
            .mockResolvedValueOnce({ data: null, error: null }) // cb_record_failure (global)
            .mockResolvedValueOnce({ data: null, error: null }); // cb_record_failure (location)
        }

        supabaseMocks.rpcMock
          .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric
          .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

        fudoApiMocks.setupTokenFailure(testCase.status);

        const request = new Request("http://localhost", { method: "POST" });
        await handler(request);

        if (testCase.shouldIncrement) {
          expect(supabaseMocks.rpcMock).toHaveBeenCalledWith("cb_record_failure", expect.any(Object));
        } else {
          expect(supabaseMocks.rpcMock).not.toHaveBeenCalledWith("cb_record_failure", expect.any(Object));
        }
      }
    });

    it("should stop processing when global circuit breaker opens during job", async () => {
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null }) // Initial global check
        .mockResolvedValueOnce({ data: mockLeasedCredentials(3), error: null }) // 3 candidates
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null }) // Location 1 check
        .mockResolvedValueOnce({ data: { state: "open" }, error: null }) // Global CB opens after failure
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_failure (location)
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      fudoApiMocks.setup5xxError(500);

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.result.processed).toBe(1); // Only processed first location
      expect(result.result.failures).toBe(1);
      expect(result.result.circuit_breaker_blocked).toBe(2); // Remaining 2 locations blocked
    });
  });

  describe("Circuit Breaker Metrics", () => {
    it("should record accurate circuit breaker metrics in job summary", async () => {
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(3), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("open", false), error: null }) // Location 1 blocked
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null }) // Location 2 ok
        .mockResolvedValueOnce({
          data: [{ operation_result: "token_updated", rows_affected: 1, token_id: "test", is_idempotent: false }],
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_success
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_success
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null }) // Location 3 ok
        .mockResolvedValueOnce({
          data: [{ operation_result: "token_updated", rows_affected: 1, token_id: "test", is_idempotent: false }],
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_success
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_success
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (job summary)
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (attempt 1)
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (attempt 2)
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      fudoApiMocks.mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => fudoApiMocks.mockSuccessfulTokenResponse() })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => fudoApiMocks.mockSuccessfulMeResponse() })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => fudoApiMocks.mockSuccessfulTokenResponse() })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => fudoApiMocks.mockSuccessfulMeResponse() });

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.result.circuit_breaker_blocked).toBe(1);
      expect(result.result.successes).toBe(2);

      // Verify job summary metrics include circuit breaker stats
      const jobSummaryCall = supabaseMocks.rpcMock.mock.calls.find(
        call => call[0] === "record_rotation_metric" && call[1].p_metric_type === "job_summary"
      );
      expect(jobSummaryCall).toBeDefined();
      expect(jobSummaryCall[1].p_meta.circuit_breaker_blocked).toBe(1);
    });
  });
});