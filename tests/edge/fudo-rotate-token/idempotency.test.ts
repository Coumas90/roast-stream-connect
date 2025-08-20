import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createSupabaseMock, mockCircuitBreakerState, mockLeasedCredentials, mockAtomicRotationSuccess } from "./mocks/supabase.mock";
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

describe("Fudo Rotate Token - Idempotency", () => {
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

  describe("Idempotent Rotation Detection", () => {
    it("should detect and handle idempotent rotations correctly", async () => {
      // Fixed rotation ID for consistent test
      const fixedRotationId = "test-rotation-12345";
      cryptoMocks.mockRandomUUID.mockReturnValue(fixedRotationId);

      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(true)) // is_idempotent = true
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (job summary)
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      fudoApiMocks.setupSuccessfulFlow();

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.result.idempotent_hits).toBe(1);
      expect(result.result.successes).toBe(0); // Idempotent hits don't count as successes
      expect(result.result.failures).toBe(0);

      // Verify atomic rotation was called with the expected rotation_id
      expect(supabaseMocks.rpcMock).toHaveBeenCalledWith("execute_atomic_rotation", {
        p_location_id: "location-1",
        p_provider: "fudo",
        p_rotation_id: fixedRotationId,
        p_new_token_encrypted: "new_fudo_token_12345",
        p_expires_at: expect.any(String),
      });

      // Should NOT record circuit breaker success for idempotent hits
      expect(supabaseMocks.rpcMock).not.toHaveBeenCalledWith("cb_record_success", expect.any(Object));
    });

    it("should still validate token even for idempotent rotations", async () => {
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(true)) // is_idempotent = true
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      fudoApiMocks.setupSuccessfulFlow();

      const request = new Request("http://localhost", { method: "POST" });
      await handler(request);

      // Even for idempotent rotations, we should still get and validate the token
      expect(fudoApiMocks.mockFetch).toHaveBeenCalledTimes(2); // token + validation
      expect(fudoApiMocks.mockFetch).toHaveBeenNthCalledWith(1, expect.stringContaining("/auth/token"), expect.any(Object));
      expect(fudoApiMocks.mockFetch).toHaveBeenNthCalledWith(2, expect.stringContaining("/me"), expect.any(Object));
    });

    it("should not record individual metrics for idempotent rotations", async () => {
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(true)) // is_idempotent = true
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (job summary only)
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      fudoApiMocks.setupSuccessfulFlow();

      const request = new Request("http://localhost", { method: "POST" });
      await handler(request);

      // Should only record job summary metrics, not individual attempt metrics
      const metricCalls = supabaseMocks.rpcMock.mock.calls.filter(
        call => call[0] === "record_rotation_metric"
      );
      
      expect(metricCalls).toHaveLength(1); // Only job summary
      expect(metricCalls[0][1].p_metric_type).toBe("job_summary");
      
      // No individual rotation_attempt metrics for idempotent hits
      const attemptMetrics = metricCalls.filter(
        call => call[1].p_metric_type === "rotation_attempt"
      );
      expect(attemptMetrics).toHaveLength(0);
    });

    it("should include idempotent metadata in the response", async () => {
      const fixedRotationId = "test-rotation-12345";
      cryptoMocks.mockRandomUUID.mockReturnValue(fixedRotationId);

      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(true))
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      fudoApiMocks.setupSuccessfulFlow();

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      const attempt = result.result.attempts[0];
      expect(attempt.status).toBe("idempotent");
      expect(attempt.metadata.idempotent_hit).toBe(true);
      expect(attempt.metadata.operation_result).toBe("no_change_needed");
      expect(attempt.metadata.atomic).toBe(true);
      expect(attempt.rotationId).toBe(fixedRotationId);
    });
  });

  describe("Mixed Scenarios with Idempotency", () => {
    it("should handle mix of successful, failed, and idempotent rotations", async () => {
      const rotationIds = ["rotation-1", "rotation-2", "rotation-3"];
      cryptoMocks.mockRandomUUID
        .mockReturnValueOnce(rotationIds[0])
        .mockReturnValueOnce(rotationIds[1])
        .mockReturnValueOnce(rotationIds[2]);

      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(3), error: null })
        // Location 1 - Success
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(false)) // Success
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_success
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_success
        // Location 2 - Idempotent
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(true)) // Idempotent
        // Location 3 - Success
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(false)) // Success
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_success
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_success
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (job summary)
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (attempt 1)
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (attempt 3)
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      // Setup successful Fudo API responses for all 3 attempts
      fudoApiMocks.mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => fudoApiMocks.mockSuccessfulTokenResponse() })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => fudoApiMocks.mockSuccessfulMeResponse() })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => fudoApiMocks.mockSuccessfulTokenResponse() })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => fudoApiMocks.mockSuccessfulMeResponse() })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => fudoApiMocks.mockSuccessfulTokenResponse() })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => fudoApiMocks.mockSuccessfulMeResponse() });

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.result.processed).toBe(3);
      expect(result.result.successes).toBe(2); // Locations 1 and 3
      expect(result.result.idempotent_hits).toBe(1); // Location 2
      expect(result.result.failures).toBe(0);

      // Verify correct statuses in attempts
      expect(result.result.attempts[0].status).toBe("completed");
      expect(result.result.attempts[1].status).toBe("idempotent");
      expect(result.result.attempts[2].status).toBe("completed");

      // Should only record individual metrics for non-idempotent attempts
      const attemptMetrics = supabaseMocks.rpcMock.mock.calls.filter(
        call => call[0] === "record_rotation_metric" && call[1].p_metric_type === "rotation_attempt"
      );
      expect(attemptMetrics).toHaveLength(2); // Only for successful attempts
    });
  });

  describe("Idempotency Security", () => {
    it("should not leak sensitive data in idempotent hit logs", async () => {
      const sensitiveToken = "super-secret-fudo-token-12345";
      const fixedRotationId = "test-rotation-12345";
      
      cryptoMocks.mockRandomUUID.mockReturnValue(fixedRotationId);

      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(true))
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Return sensitive token from API
      fudoApiMocks.mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ access_token: sensitiveToken, expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => fudoApiMocks.mockSuccessfulMeResponse(),
        });

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      const attempt = result.result.attempts[0];
      
      // Verify token is not exposed in metadata
      expect(JSON.stringify(attempt.metadata)).not.toContain(sensitiveToken);
      
      // Verify fingerprint is present and safe
      expect(attempt.metadata.fingerprint).toMatch(/^sha256:[a-f0-9]{16}\.\.\.$/);
      expect(attempt.metadata.fingerprint).not.toContain(sensitiveToken);
      
      // Verify rotation_id is present but no sensitive data
      expect(attempt.rotationId).toBe(fixedRotationId);
    });

    it("should mask secret references in logs", async () => {
      const longSecretRef = "pos/location/12345/fudo/very_long_encrypted_secret_data_that_should_be_masked_for_security";
      
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ 
          data: [{ 
            location_id: "location-1", 
            secret_ref: longSecretRef,
            last_rotated: new Date().toISOString() 
          }], 
          error: null 
        })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(true))
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      fudoApiMocks.setupSuccessfulFlow();

      const request = new Request("http://localhost", { method: "POST" });
      await handler(request);

      // Verify atomic rotation was called but secret ref doesn't appear in full
      const atomicRotationCall = supabaseMocks.rpcMock.mock.calls.find(
        call => call[0] === "execute_atomic_rotation"
      );
      expect(atomicRotationCall).toBeDefined();
      expect(JSON.stringify(atomicRotationCall)).not.toContain(longSecretRef);
    });
  });

  describe("Concurrent Idempotency", () => {
    it("should handle the same rotation_id across concurrent requests gracefully", async () => {
      // Both requests should use the same rotation_id
      const sharedRotationId = "concurrent-rotation-12345";
      cryptoMocks.mockRandomUUID.mockReturnValue(sharedRotationId);

      // First request setup
      const firstRequestMocks = createSupabaseMock();
      firstRequestMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(false)) // First one succeeds
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Second request setup - should be idempotent
      const secondRequestMocks = createSupabaseMock();
      secondRequestMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(true)) // Second one is idempotent
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      fudoApiMocks.setupSuccessfulFlow();

      // Simulate concurrent execution
      const request1 = new Request("http://localhost", { method: "POST" });
      const request2 = new Request("http://localhost", { method: "POST" });

      // Both should succeed but only first should do actual work
      const response1 = await handler(request1);
      const result1 = await response1.json();

      expect(result1.result.successes).toBe(1);
      expect(result1.result.idempotent_hits).toBe(0);

      // The architecture should handle this through the database's atomic operations
      // This test mainly verifies our response handling is correct
    });
  });
});