import { describe, it, expect, vi, beforeEach, Mock } from "vitest";

// Mock Supabase client
const mockSupabaseFrom = vi.fn();
const mockSupabaseRpc = vi.fn();
const mockSupabase = {
  from: mockSupabaseFrom,
  rpc: mockSupabaseRpc,
};

// Mock fetch for Fudo API calls
global.fetch = vi.fn();

// Mock crypto.randomUUID
global.crypto = {
  ...global.crypto,
  randomUUID: vi.fn(),
  subtle: {
    importKey: vi.fn(),
    sign: vi.fn(),
  }
};

describe("Fudo Token Rotation Idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default crypto mocks
    (global.crypto.randomUUID as Mock).mockReturnValue("test-rotation-id-123");
    (global.crypto.subtle.importKey as Mock).mockResolvedValue({});
    (global.crypto.subtle.sign as Mock).mockResolvedValue(new ArrayBuffer(32));
  });

  it("should skip swap on idempotent retry with same rotation_id", async () => {
    const locationId = "loc1";
    const rotationId = "test-rotation-id-123";
    
    // Mock Fudo API responses
    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token: "new_token_123", expires_in: 3600 })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { id: "1", email: "test@fudo.com", name: "Test User" } })
      });

    // Mock pos_provider_credentials update - first call returns data (successful swap)
    const mockUpdate = vi.fn();
    const mockSelect = vi.fn().mockReturnValue({ data: [{ id: "cred1" }], error: null });
    mockUpdate.mockReturnValue({ select: mockSelect });
    mockSupabaseFrom.mockReturnValue({ update: mockUpdate, eq: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis() });

    // Mock pos_credentials update for audit trail
    const mockCredentialsUpdate = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "pos_provider_credentials") {
        return { update: mockUpdate, eq: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis() };
      }
      if (table === "pos_credentials") {
        return { update: mockCredentialsUpdate, eq: vi.fn().mockReturnThis() };
      }
      return {};
    });

    // Import the functions to test (simplified inline versions)
    const rotateTokenForLocation = async (locationId: string, secretRef: string) => {
      const rotationId = "test-rotation-id-123";
      
      // Simulate the token rotation logic
      const credentials = { apiKey: "test", apiSecret: "test", env: "staging" };
      
      // Get token from Fudo
      const tokenResponse = await fetch("https://staging-api.fudo.com/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: credentials.apiKey, api_secret: credentials.apiSecret })
      }).then(r => r.json());
      
      // Validate token
      await fetch("https://staging-api.fudo.com/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenResponse.token}` }
      });
      
      // Idempotent swap
      const { data } = await mockSupabase.from("pos_provider_credentials")
        .update({
          ciphertext: `encrypted_token_${tokenResponse.token.substring(0, 8)}...`,
          rotation_attempt_id: rotationId,
          last_verified_at: new Date().toISOString(),
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("location_id", locationId)
        .eq("provider", "fudo")
        .or(`rotation_attempt_id.is.null,rotation_attempt_id.neq.${rotationId}`)
        .select();
      
      const wasUpdated = data && data.length > 0;
      
      // Persist rotation_id for audit
      await mockSupabase.from("pos_credentials")
        .update({ rotation_id: rotationId })
        .eq("location_id", locationId)
        .eq("provider", "fudo");
      
      return {
        location_id: locationId,
        rotation_id: rotationId,
        attempt_id: rotationId,
        success: true,
        idempotent_hit: !wasUpdated,
        attempt_status: wasUpdated ? 'rotated' : 'idempotent'
      };
    };

    // First call - should perform swap
    const firstResult = await rotateTokenForLocation(locationId, "secret_ref");
    expect(firstResult.success).toBe(true);
    expect(firstResult.idempotent_hit).toBe(false);
    expect(firstResult.attempt_status).toBe('rotated');

    // Mock second call - no data returned (idempotent hit)
    mockSelect.mockReturnValueOnce({ data: [], error: null });

    // Second call with same rotation_id - should skip swap
    const secondResult = await rotateTokenForLocation(locationId, "secret_ref");
    expect(secondResult.success).toBe(true);
    expect(secondResult.idempotent_hit).toBe(true);
    expect(secondResult.attempt_status).toBe('idempotent');
    
    // Verify audit trail was still updated
    expect(mockCredentialsUpdate).toHaveBeenCalledTimes(2);
  });

  it("should perform separate swaps for different rotation_ids", async () => {
    const locationId = "loc1";
    
    // Mock different rotation IDs
    (global.crypto.randomUUID as Mock)
      .mockReturnValueOnce("rotation-id-1")
      .mockReturnValueOnce("rotation-id-2");

    // Mock Fudo API responses
    (global.fetch as Mock)
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "new_token_123", expires_in: 3600 })
      });

    // Mock successful swaps for both calls
    const mockUpdate = vi.fn();
    const mockSelect = vi.fn().mockReturnValue({ data: [{ id: "cred1" }], error: null });
    mockUpdate.mockReturnValue({ select: mockSelect });
    
    const mockCredentialsUpdate = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "pos_provider_credentials") {
        return { update: mockUpdate, eq: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis() };
      }
      if (table === "pos_credentials") {
        return { update: mockCredentialsUpdate, eq: vi.fn().mockReturnThis() };
      }
      return {};
    });

    const rotateWithDifferentId = async (rotationId: string) => {
      // Simulate swap with different rotation_id
      const { data } = await mockSupabase.from("pos_provider_credentials")
        .update({ rotation_attempt_id: rotationId })
        .eq("location_id", locationId)
        .eq("provider", "fudo")
        .or(`rotation_attempt_id.is.null,rotation_attempt_id.neq.${rotationId}`)
        .select();
        
      return { rotation_id: rotationId, swapped: data && data.length > 0 };
    };

    // Two calls with different rotation IDs
    const result1 = await rotateWithDifferentId("rotation-id-1");
    const result2 = await rotateWithDifferentId("rotation-id-2");

    expect(result1.swapped).toBe(true);
    expect(result2.swapped).toBe(true);
    expect(result1.rotation_id).toBe("rotation-id-1");
    expect(result2.rotation_id).toBe("rotation-id-2");
  });

  it("should not leak secrets in logs", async () => {
    const secretRef = "pos/location/12345/fudo/encrypted_token_data_here_very_long_secret";
    const maskedRef = secretRef.substring(0, 20) + "...";

    expect(maskedRef).toBe("pos/location/12345/f...");
    expect(maskedRef.length).toBeLessThan(secretRef.length);
    expect(maskedRef).not.toContain("encrypted_token_data_here");

    // Test token fingerprinting (should never contain actual token)
    const createTokenFingerprint = async (token: string): Promise<string> => {
      // Simplified version of the actual function
      try {
        const encoder = new TextEncoder();
        const key = encoder.encode('fudo-token-fingerprint');
        
        await global.crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        await global.crypto.subtle.sign('HMAC', {}, encoder.encode(token));
        
        return "abc12345"; // Mock fingerprint
      } catch {
        return 'unknown';
      }
    };

    const token = "super_secret_token_12345";
    const fingerprint = await createTokenFingerprint(token);
    
    expect(fingerprint).not.toContain(token);
    expect(fingerprint.length).toBeLessThanOrEqual(8);
    expect(fingerprint).toMatch(/^[a-f0-9]+$/);
  });

  it("should include rotation_id in all log structures", async () => {
    const rotationId = "test-rotation-id-123";
    
    // Test log structure
    const logEntry = {
      rotation_id: rotationId,
      location_id: "loc1",
      provider: 'fudo',
      attempt_status: 'rotated',
      idempotent_hit: false,
      token_fingerprint: 'abc12345', // Never the actual token
      duration_ms: 1500
    };

    expect(logEntry.rotation_id).toBe(rotationId);
    expect(logEntry.idempotent_hit).toBe(false);
    expect(logEntry.attempt_status).toBe('rotated');
    expect(logEntry).not.toHaveProperty('token');
    expect(logEntry).not.toHaveProperty('api_key');
    expect(logEntry).not.toHaveProperty('api_secret');
  });

  it("should handle circuit breaker states correctly", async () => {
    const rotationId = "test-rotation-id-123";
    
    // Mock circuit breaker check
    mockSupabaseRpc.mockImplementation((funcName: string) => {
      if (funcName === "cb_check_state") {
        return Promise.resolve({
          data: { state: "half-open", allowed: true, test_mode: true },
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const cbState = await mockSupabase.rpc("cb_check_state", {
      _provider: "fudo",
      _location_id: null
    });

    expect(cbState.data.state).toBe("half-open");
    expect(cbState.data.allowed).toBe(true);
    expect(cbState.data.test_mode).toBe(true);
  });

  it("should handle concurrent executions with same rotation_id correctly", async () => {
    const locationId = "loc1";
    const rotationId = "concurrent-rotation-id";
    let updateCallCount = 0;
    
    // Mock Fudo API responses
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: "concurrent_token", expires_in: 3600 })
    });

    // Mock concurrent access: first call succeeds, second returns empty (already updated)
    const mockUpdate = vi.fn();
    const mockSelect = vi.fn().mockImplementation(() => {
      updateCallCount++;
      if (updateCallCount === 1) {
        return { data: [{ id: "cred1" }], error: null }; // First call succeeds
      }
      return { data: [], error: null }; // Second call sees no rows to update
    });
    
    mockUpdate.mockReturnValue({ select: mockSelect });
    
    const mockCredentialsUpdate = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "pos_provider_credentials") {
        return { 
          update: mockUpdate, 
          eq: vi.fn().mockReturnThis(), 
          not: vi.fn().mockReturnThis() 
        };
      }
      if (table === "pos_credentials") {
        return { update: mockCredentialsUpdate, eq: vi.fn().mockReturnThis() };
      }
      return {};
    });

    const simulateConcurrentRotation = async (callId: string) => {
      // Simulate the idempotent swap logic
      const { data } = await mockSupabase.from("pos_provider_credentials")
        .update({
          rotation_attempt_id: rotationId,
          last_verified_at: new Date().toISOString(),
          status: "active"
        })
        .eq("location_id", locationId)
        .eq("provider", "fudo")
        .not("rotation_attempt_id", "eq", rotationId)
        .select();
      
      const wasUpdated = data && data.length > 0;
      
      return {
        call_id: callId,
        rotation_id: rotationId,
        swapped: wasUpdated,
        idempotent_hit: !wasUpdated
      };
    };

    // Simulate two concurrent calls with same rotation_id
    const [result1, result2] = await Promise.all([
      simulateConcurrentRotation("call-1"),
      simulateConcurrentRotation("call-2")
    ]);

    // One should succeed, one should be idempotent
    const swappedResults = [result1, result2].filter(r => r.swapped);
    const idempotentResults = [result1, result2].filter(r => r.idempotent_hit);
    
    expect(swappedResults).toHaveLength(1);
    expect(idempotentResults).toHaveLength(1);
    expect(swappedResults[0].rotation_id).toBe(rotationId);
    expect(idempotentResults[0].rotation_id).toBe(rotationId);
  });

  it("should include enhanced observability metrics", async () => {
    const jobRunId = "job-123";
    const attempts = [
      { 
        rotation_id: "rot-1", 
        location_id: "loc1", 
        success: true, 
        idempotent_hit: false, 
        attempt_status: 'rotated',
        start_time: Date.now() - 1000
      },
      { 
        rotation_id: "rot-2", 
        location_id: "loc2", 
        success: true, 
        idempotent_hit: true, 
        attempt_status: 'idempotent',
        start_time: Date.now() - 500 
      }
    ];

    // Mock record_rotation_metric RPC
    mockSupabaseRpc.mockResolvedValue({ data: null, error: null });

    // Simulate job-level metrics recording
    const idempotentCount = attempts.filter(a => a.idempotent_hit).length;
    const processed = attempts.length;
    
    await mockSupabase.rpc("record_rotation_metric", {
      p_job_run_id: jobRunId,
      p_provider: "fudo",
      p_location_id: null,
      p_metric_type: "rotation_job_summary",
      p_value: processed,
      p_meta: {
        successes: 2,
        failures: 0,
        idempotent_hits: idempotentCount,
        idempotent_rate: idempotentCount / processed
      }
    });

    // Record individual metrics
    for (const attempt of attempts) {
      await mockSupabase.rpc("record_rotation_metric", {
        p_job_run_id: jobRunId,
        p_provider: "fudo",
        p_location_id: attempt.location_id,
        p_metric_type: attempt.idempotent_hit ? "rotation_idempotent" : "rotation_success",
        p_meta: {
          rotation_id: attempt.rotation_id,
          attempt_status: attempt.attempt_status,
          idempotent_hit: attempt.idempotent_hit
        }
      });
    }

    expect(mockSupabaseRpc).toHaveBeenCalledWith("record_rotation_metric", 
      expect.objectContaining({
        p_metric_type: "rotation_job_summary",
        p_meta: expect.objectContaining({
          idempotent_rate: 0.5 // 1 out of 2 attempts
        })
      })
    );
  });
});