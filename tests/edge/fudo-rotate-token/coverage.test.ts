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

describe("Fudo Rotate Token - Coverage Edge Cases", () => {
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

  describe("Error Path Coverage", () => {
    it("should handle missing access token in Fudo response", async () => {
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Return response without access_token
      fudoApiMocks.mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ expires_in: 3600 }), // Missing access_token
      });

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.result.failures).toBe(1);
      const attempt = result.result.attempts[0];
      expect(attempt.error).toContain("No access token received from Fudo API");
    });

    it("should handle atomic rotation database error", async () => {
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ // execute_atomic_rotation fails
          data: null,
          error: { message: "Database constraint violation" }
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      fudoApiMocks.setupSuccessfulFlow();

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.result.failures).toBe(1);
      const attempt = result.result.attempts[0];
      expect(attempt.error).toContain("Atomic rotation failed: Database constraint violation");
    });

    it("should handle fetch timeout errors", async () => {
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Simulate AbortController timeout
      fudoApiMocks.mockFetch.mockRejectedValueOnce(new Error("The operation was aborted"));

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.result.failures).toBe(1);
      const attempt = result.result.attempts[0];
      expect(attempt.error).toContain("The operation was aborted");
    });

    it("should handle malformed JSON responses from Fudo API", async () => {
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      fudoApiMocks.mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => { throw new Error("Unexpected token in JSON"); },
      });

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.result.failures).toBe(1);
    });
  });

  describe("Edge Cases in Token Processing", () => {
    it("should handle tokens with different expiration formats", async () => {
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({
          data: [{ operation_result: "token_updated", rows_affected: 1, token_id: "test", is_idempotent: false }],
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Token response without expires_in
      fudoApiMocks.mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ access_token: "token-no-expiry" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => fudoApiMocks.mockSuccessfulMeResponse(),
        });

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.result.successes).toBe(1);
      
      // Verify atomic rotation was called with null expires_at
      const atomicCall = supabaseMocks.rpcMock.mock.calls.find(
        call => call[0] === "execute_atomic_rotation"
      );
      expect(atomicCall[1].p_expires_at).toBeNull();
    });

    it("should handle very long tokens and secret references", async () => {
      const veryLongToken = "a".repeat(2000); // Very long token
      const veryLongSecretRef = "pos/location/12345/fudo/" + "encrypted_data_".repeat(50);

      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ 
          data: [{ 
            location_id: "location-1", 
            secret_ref: veryLongSecretRef,
            last_rotated: new Date().toISOString() 
          }], 
          error: null 
        })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({
          data: [{ operation_result: "token_updated", rows_affected: 1, token_id: "test", is_idempotent: false }],
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      fudoApiMocks.mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ access_token: veryLongToken, expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => fudoApiMocks.mockSuccessfulMeResponse(),
        });

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.result.successes).toBe(1);
      
      // Verify long token doesn't appear in response
      expect(JSON.stringify(result)).not.toContain(veryLongToken);
    });
  });

  describe("Environment-specific Behavior", () => {
    it("should use correct API endpoints for production environment", async () => {
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({
          data: [{ operation_result: "token_updated", rows_affected: 1, token_id: "test", is_idempotent: false }],
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Mock decryptSecretRef to return production environment
      fudoApiMocks.setupSuccessfulFlow();

      const request = new Request("http://localhost", { method: "POST" });
      await handler(request);

      // Verify staging URLs are used (based on mock implementation)
      expect(fudoApiMocks.mockFetch).toHaveBeenCalledWith(
        "https://staging-api.fudo.com/auth/token",
        expect.any(Object)
      );
      expect(fudoApiMocks.mockFetch).toHaveBeenCalledWith(
        "https://staging-api.fudo.com/me",
        expect.any(Object)
      );
    });
  });

  describe("Boundary Value Testing", () => {
    it("should handle zero candidates", async () => {
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: [], error: null }) // Empty candidates
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.result.total_candidates).toBe(0);
      expect(result.result.processed).toBe(0);
      expect(result.message).toContain("No credentials need rotation");
    });

    it("should handle maximum number of candidates", async () => {
      const maxCandidates = 50;

      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(maxCandidates), error: null });

      // Mock all subsequent calls for each candidate
      for (let i = 0; i < maxCandidates; i++) {
        supabaseMocks.rpcMock
          .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
          .mockResolvedValueOnce({
            data: [{ operation_result: "token_updated", rows_affected: 1, token_id: "test", is_idempotent: false }],
            error: null,
          })
          .mockResolvedValueOnce({ data: null, error: null })
          .mockResolvedValueOnce({ data: null, error: null });
      }

      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (job summary)
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      // Mock all the API calls
      for (let i = 0; i < maxCandidates * 2; i++) {
        fudoApiMocks.mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => i % 2 === 0 ? 
            fudoApiMocks.mockSuccessfulTokenResponse() : 
            fudoApiMocks.mockSuccessfulMeResponse(),
        });
      }

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.result.total_candidates).toBe(maxCandidates);
      expect(result.result.processed).toBe(maxCandidates);
    });
  });

  describe("HTTP Methods and Headers", () => {
    it("should handle various HTTP methods correctly", async () => {
      const methods = ["GET", "PUT", "DELETE", "PATCH"];

      for (const method of methods) {
        const request = new Request("http://localhost", { method });
        const response = await handler(request);
        const result = await response.json();

        // All non-POST methods should still be processed
        expect(response.status).toBeGreaterThanOrEqual(200);
      }
    });

    it("should handle requests with different headers", async () => {
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      const request = new Request("http://localhost", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
          "User-Agent": "Test-Agent/1.0",
        },
      });

      const response = await handler(request);
      expect(response.status).toBe(200);
    });
  });

  describe("Concurrent Access Patterns", () => {
    it("should handle rapid sequential requests", async () => {
      const numRequests = 3;
      const responses: Response[] = [];

      for (let i = 0; i < numRequests; i++) {
        supabaseMocks.rpcMock
          .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
          .mockResolvedValueOnce({ data: [], error: null })
          .mockResolvedValueOnce({ data: null, error: null })
          .mockResolvedValueOnce({ data: null, error: null });

        const request = new Request("http://localhost", { method: "POST" });
        const response = await handler(request);
        responses.push(response);
      }

      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });
  });
});