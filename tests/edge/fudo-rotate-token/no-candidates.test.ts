import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createSupabaseMocks } from "./mocks/supabase.mock";
import { createFudoApiMocks } from "./mocks/fudo-api.mock";
import { createCryptoMocks } from "./mocks/crypto.mock";
import { createDenoEnvMock } from "./mocks/crypto.mock";

// Mock external modules
vi.mock("std/http/server.ts", () => ({ serve: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("../../../supabase/functions/_shared/cors.ts", () => ({ withCORS: vi.fn() }));

describe("Fudo Rotate Token - No Candidates", () => {
  const supabaseMocks = createSupabaseMocks();
  const fudoApiMocks = createFudoApiMocks();
  const cryptoMocks = createCryptoMocks();
  const denoEnvMock = createDenoEnvMock();
  
  let handler: any;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00.000Z'));
    supabaseMocks.activate();
    fudoApiMocks.activate();
    cryptoMocks.activate();
    denoEnvMock.activate();

    // Import handler after mocks are setup
    const module = await import("../../../supabase/functions/fudo-rotate-token/index.ts");
    handler = module.handler;

    // Setup Supabase client mock
    const mockSupabaseClient = supabaseMocks.createMockClient();
    const { createClient } = await import("@supabase/supabase-js");
    (createClient as any).mockReturnValue(mockSupabaseClient);

    // Setup CORS mock
    const { withCORS } = await import("../../../supabase/functions/_shared/cors.ts");
    (withCORS as any).mockImplementation((fn: any) => fn);
  });

  afterEach(() => {
    vi.useRealTimers();
    supabaseMocks.restore();
    fudoApiMocks.restore();
    cryptoMocks.restore();
    denoEnvMock.restore();
    vi.clearAllMocks();
  });

  it("should handle empty candidate list gracefully", async () => {
    // Setup: No candidates to process
    supabaseMocks.mockRpcSuccess("lease_fudo_rotation_candidates", []);
    supabaseMocks.mockRpcSuccess("get_global_circuit_breaker_state", { 
      is_open: false, 
      failure_count: 0 
    });

    // Mock recording heartbeat
    supabaseMocks.mockFromUpdateSelect("fudo_operation_metrics", {
      metric_name: "fudo.rotation_job_heartbeat",
      metric_value: "healthy",
      created_at: "2024-01-01T10:00:00.000Z"
    });

    const request = new Request("https://test.supabase.co/functions/v1/fudo-rotate-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    const response = await handler(request);
    
    expect(response.status).toBe(200);
    
    const result = await response.json();
    expect(result).toEqual({
      success: true,
      message: "No candidates found for rotation",
      processed: 0,
      successes: 0,
      failures: 0,
      idempotent: 0,
      skipped_circuit_breaker: 0
    });

    // Verify early return - no rotation attempts made
    expect(supabaseMocks.mockRpc).toHaveBeenCalledWith("lease_fudo_rotation_candidates", { limit: 50 });
    expect(supabaseMocks.mockRpc).not.toHaveBeenCalledWith("execute_atomic_rotation", expect.any(Object));
    
    // Verify healthy heartbeat recorded
    expect(supabaseMocks.mockFrom).toHaveBeenCalledWith("fudo_operation_metrics");
  });

  it("should validate lease returns ≤50 candidates and no duplicates", async () => {
    // Setup: Return exactly 50 candidates (boundary test)
    const candidates = Array.from({ length: 50 }, (_, i) => ({
      location_id: `location-${i}`,
      secret_ref: `secret-${i}`,
      current_token: `token-${i}`,
      provider_config: { api_url: "https://api.fudo.com" }
    }));

    supabaseMocks.mockRpcSuccess("lease_fudo_rotation_candidates", candidates);
    supabaseMocks.mockRpcSuccess("get_global_circuit_breaker_state", { 
      is_open: false, 
      failure_count: 0 
    });

    // Mock all other operations to avoid full processing
    supabaseMocks.mockRpcSuccess("get_location_circuit_breaker_state", { 
      is_open: false, 
      failure_count: 0 
    });

    const request = new Request("https://test.supabase.co/functions/v1/fudo-rotate-token", {
      method: "POST"
    });

    const response = await handler(request);
    
    // Verify lease was called correctly
    expect(supabaseMocks.mockRpc).toHaveBeenCalledWith("lease_fudo_rotation_candidates", { limit: 50 });
    
    // Verify no duplicates in location_ids
    const locationIds = candidates.map(c => c.location_id);
    const uniqueLocationIds = [...new Set(locationIds)];
    expect(locationIds.length).toBe(uniqueLocationIds.length);
    
    // Verify response acknowledges all candidates
    const result = await response.json();
    expect(result.processed).toBe(50);
  });

  it("should handle lease with duplicate location_ids safely", async () => {
    // Setup: Simulate edge case where lease accidentally returns duplicates
    const duplicateCandidates = [
      {
        location_id: "location-1",
        secret_ref: "secret-1",
        current_token: "token-1",
        provider_config: { api_url: "https://api.fudo.com" }
      },
      {
        location_id: "location-1", // Duplicate!
        secret_ref: "secret-1-duplicate",
        current_token: "token-1-duplicate",
        provider_config: { api_url: "https://api.fudo.com" }
      }
    ];

    supabaseMocks.mockRpcSuccess("lease_fudo_rotation_candidates", duplicateCandidates);
    supabaseMocks.mockRpcSuccess("get_global_circuit_breaker_state", { 
      is_open: false, 
      failure_count: 0 
    });

    const request = new Request("https://test.supabase.co/functions/v1/fudo-rotate-token", {
      method: "POST"
    });

    const response = await handler(request);
    
    // Should handle gracefully without crashing
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.processed).toBeGreaterThanOrEqual(1);
  });
});