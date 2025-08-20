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

describe("Fudo Rotate Token - Metrics and Observability", () => {
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

  describe("Job-Level Metrics", () => {
    it("should record comprehensive job summary metrics", async () => {
      const jobRunId = "test-job-run-12345";
      cryptoMocks.mockRandomUUID
        .mockReturnValueOnce("rotation-1") // First rotation ID
        .mockReturnValueOnce(jobRunId); // Job run ID

      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(2), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(false))
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_success
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_success
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("open", false), error: null }) // Second location blocked
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (job summary)
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (attempt)
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      fudoApiMocks.setupSuccessfulFlow();

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      // Verify job summary metrics were recorded
      const jobSummaryCall = supabaseMocks.rpcMock.mock.calls.find(
        call => call[0] === "record_rotation_metric" && call[1].p_metric_type === "job_summary"
      );

      expect(jobSummaryCall).toBeDefined();
      expect(jobSummaryCall[1]).toEqual({
        p_job_run_id: jobRunId,
        p_provider: "fudo",
        p_metric_type: "job_summary",
        p_value: 2, // processed count
        p_duration_ms: expect.any(Number),
        p_meta: {
          total_candidates: 2,
          successes: 1,
          failures: 0,
          idempotent_hits: 0,
          circuit_breaker_blocked: 1,
          trigger: "cron",
          timestamp: expect.any(String)
        }
      });

      expect(result.job_run_id).toBe(jobRunId);
    });

    it("should record accurate timing metrics", async () => {
      const startTime = Date.now();

      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(false))
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      fudoApiMocks.setupSuccessfulFlow();

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      const endTime = Date.now();
      const expectedDuration = endTime - startTime;

      expect(result.duration_ms).toBeGreaterThan(0);
      expect(result.duration_ms).toBeLessThan(expectedDuration + 100); // Allow small margin

      // Verify timing is recorded in metrics
      const jobSummaryCall = supabaseMocks.rpcMock.mock.calls.find(
        call => call[0] === "record_rotation_metric" && call[1].p_metric_type === "job_summary"
      );
      expect(jobSummaryCall[1].p_duration_ms).toBeGreaterThan(0);
    });
  });

  describe("Individual Attempt Metrics", () => {
    it("should record metrics for successful rotation attempts", async () => {
      const rotationId = "rotation-attempt-12345";
      const jobRunId = "job-run-12345";
      
      cryptoMocks.mockRandomUUID
        .mockReturnValueOnce(rotationId)
        .mockReturnValueOnce(jobRunId);

      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(false))
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (job summary)
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (attempt)
        .mockResolvedValueOnce({ data: null, error: null });

      fudoApiMocks.setupSuccessfulFlow();

      const request = new Request("http://localhost", { method: "POST" });
      await handler(request);

      // Verify individual attempt metrics
      const attemptCall = supabaseMocks.rpcMock.mock.calls.find(
        call => call[0] === "record_rotation_metric" && call[1].p_metric_type === "rotation_attempt"
      );

      expect(attemptCall).toBeDefined();
      expect(attemptCall[1]).toEqual({
        p_job_run_id: jobRunId,
        p_provider: "fudo",
        p_location_id: "location-1",
        p_metric_type: "rotation_attempt",
        p_value: 1, // success = 1
        p_duration_ms: expect.any(Number),
        p_meta: {
          rotation_id: rotationId,
          status: "completed",
          error: undefined,
          operation_result: "token_updated",
          rows_affected: 1,
          token_id: "token-12345",
          fingerprint: expect.stringMatching(/^sha256:[a-f0-9]{16}\.\.\.$/),
          expires_in: 3600,
          atomic: true
        }
      });
    });

    it("should record metrics for failed rotation attempts", async () => {
      const rotationId = "failed-rotation-12345";
      const jobRunId = "job-run-12345";
      
      cryptoMocks.mockRandomUUID
        .mockReturnValueOnce(rotationId)
        .mockReturnValueOnce(jobRunId);

      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_failure
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_failure
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (job summary)
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (attempt)
        .mockResolvedValueOnce({ data: null, error: null });

      fudoApiMocks.setupTokenFailure(500); // 5xx error

      const request = new Request("http://localhost", { method: "POST" });
      await handler(request);

      const attemptCall = supabaseMocks.rpcMock.mock.calls.find(
        call => call[0] === "record_rotation_metric" && call[1].p_metric_type === "rotation_attempt"
      );

      expect(attemptCall).toBeDefined();
      expect(attemptCall[1].p_value).toBe(0); // failure = 0
      expect(attemptCall[1].p_meta.status).toBe("failed");
      expect(attemptCall[1].p_meta.error).toContain("Token request failed: 500");
    });

    it("should NOT record individual metrics for idempotent attempts", async () => {
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(true)) // idempotent
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (job summary only)
        .mockResolvedValueOnce({ data: null, error: null });

      fudoApiMocks.setupSuccessfulFlow();

      const request = new Request("http://localhost", { method: "POST" });
      await handler(request);

      // Should only have job summary metrics, no individual attempt metrics
      const metricCalls = supabaseMocks.rpcMock.mock.calls.filter(
        call => call[0] === "record_rotation_metric"
      );

      expect(metricCalls).toHaveLength(1);
      expect(metricCalls[0][1].p_metric_type).toBe("job_summary");
    });
  });

  describe("Heartbeat Metrics", () => {
    it("should record healthy heartbeat on successful job completion", async () => {
      const jobRunId = "healthy-job-12345";
      cryptoMocks.mockRandomUUID
        .mockReturnValueOnce("rotation-1")
        .mockReturnValueOnce(jobRunId);

      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(false))
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      fudoApiMocks.setupSuccessfulFlow();

      const request = new Request("http://localhost", { method: "POST" });
      await handler(request);

      const heartbeatCall = supabaseMocks.rpcMock.mock.calls.find(
        call => call[0] === "update_job_heartbeat"
      );

      expect(heartbeatCall).toBeDefined();
      expect(heartbeatCall[1]).toEqual({
        p_job_name: "fudo_rotate_token",
        p_status: "healthy",
        p_metadata: {
          last_execution: expect.any(String),
          total_candidates: 1,
          successes: 1,
          failures: 0,
          idempotent_hits: 0,
          duration_ms: expect.any(Number),
          job_run_id: jobRunId
        }
      });
    });

    it("should record unhealthy heartbeat when all rotations fail", async () => {
      const jobRunId = "unhealthy-job-12345";
      cryptoMocks.mockRandomUUID
        .mockReturnValueOnce("rotation-1")
        .mockReturnValueOnce(jobRunId);

      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(1), error: null })
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_failure
        .mockResolvedValueOnce({ data: null, error: null }) // cb_record_failure
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      fudoApiMocks.setupTokenFailure(500);

      const request = new Request("http://localhost", { method: "POST" });
      await handler(request);

      const heartbeatCall = supabaseMocks.rpcMock.mock.calls.find(
        call => call[0] === "update_job_heartbeat"
      );

      expect(heartbeatCall[1].p_status).toBe("unhealthy");
      expect(heartbeatCall[1].p_metadata.total_failures).toBe(1);
      expect(heartbeatCall[1].p_metadata.error_summary).toBe("All rotation attempts failed");
    });

    it("should record healthy heartbeat when no candidates need rotation", async () => {
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: [], error: null }) // No candidates
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      expect(result.message).toContain("No credentials need rotation");

      const heartbeatCall = supabaseMocks.rpcMock.mock.calls.find(
        call => call[0] === "update_job_heartbeat"
      );
      expect(heartbeatCall[1].p_status).toBe("healthy");
    });
  });

  describe("Metric Accuracy and Consistency", () => {
    it("should maintain consistent metrics across job summary and individual attempts", async () => {
      supabaseMocks.rpcMock
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: mockLeasedCredentials(3), error: null })
        // Location 1 - Success
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(false))
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        // Location 2 - Failure
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        // Location 3 - Idempotent
        .mockResolvedValueOnce({ data: mockCircuitBreakerState("closed"), error: null })
        .mockResolvedValueOnce(mockAtomicRotationSuccess(true))
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (job summary)
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (attempt 1)
        .mockResolvedValueOnce({ data: null, error: null }) // record_rotation_metric (attempt 2)
        .mockResolvedValueOnce({ data: null, error: null }); // update_job_heartbeat

      fudoApiMocks.mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => fudoApiMocks.mockSuccessfulTokenResponse() })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => fudoApiMocks.mockSuccessfulMeResponse() })
        .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "Server error" })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => fudoApiMocks.mockSuccessfulTokenResponse() })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => fudoApiMocks.mockSuccessfulMeResponse() });

      const request = new Request("http://localhost", { method: "POST" });
      const response = await handler(request);
      const result = await response.json();

      // Verify response consistency
      expect(result.result.processed).toBe(3);
      expect(result.result.successes).toBe(1);
      expect(result.result.failures).toBe(1);
      expect(result.result.idempotent_hits).toBe(1);

      // Verify job summary metrics match response
      const jobSummaryCall = supabaseMocks.rpcMock.mock.calls.find(
        call => call[0] === "record_rotation_metric" && call[1].p_metric_type === "job_summary"
      );
      expect(jobSummaryCall[1].p_meta.successes).toBe(1);
      expect(jobSummaryCall[1].p_meta.failures).toBe(1);
      expect(jobSummaryCall[1].p_meta.idempotent_hits).toBe(1);

      // Verify individual attempt metrics (should only be 2 - success and failure, not idempotent)
      const attemptCalls = supabaseMocks.rpcMock.mock.calls.filter(
        call => call[0] === "record_rotation_metric" && call[1].p_metric_type === "rotation_attempt"
      );
      expect(attemptCalls).toHaveLength(2);
    });
  });
});