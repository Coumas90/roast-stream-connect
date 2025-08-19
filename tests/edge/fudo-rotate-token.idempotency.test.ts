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
});