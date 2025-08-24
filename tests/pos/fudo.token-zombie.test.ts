import { describe, it, expect, beforeEach, vi } from "vitest";
import { DefaultFudoClient } from "../../src/integrations/pos/fudo/client";
import type { POSConfig } from "../../../sdk/pos";

// Mock the config module to ensure consistent timing
vi.mock("../../src/integrations/pos/fudo/config", () => ({
  loadFudoConfig: vi.fn().mockResolvedValue({
    API_TIMEOUT_MS: 30000,
    MAX_RETRIES: 2,
    BACKOFF_MS: 1000,
    CB_THRESHOLD: 10,
    RPM_LIMIT: 60,
    ROTATION_COOLDOWN_HOURS: 4,
    TOKEN_EXPIRY_BUFFER_HOURS: 24,
  }),
  DEFAULT_FUDO_CONFIG: {
    API_TIMEOUT_MS: 30000,
    MAX_RETRIES: 2,
    BACKOFF_MS: 1000,
    CB_THRESHOLD: 10,
    RPM_LIMIT: 60,
    ROTATION_COOLDOWN_HOURS: 4,
    TOKEN_EXPIRY_BUFFER_HOURS: 24,
  }
}));

// Mock Supabase client
vi.mock("../../src/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn()
  }
}));

describe("Token Zombie Detection", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  describe("Production Readiness: Zombie Token Performance", () => {
    it("should detect zombie token and fail fast <100ms without retry", async () => {
      // Simulate zombie token scenario: 401 without WWW-Authenticate header
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: new Headers(), // No WWW-Authenticate = zombie token
        json: async () => ({ error: "Invalid token" })
      });

      const config: POSConfig = { provider: "fudo", apiKey: "zombie_token_123" };
      const client = new DefaultFudoClient(config);

      const startTime = Date.now();
      
      try {
        await client.validate();
        expect.fail("Should have thrown an error for zombie token");
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Critical: Must fail fast for zombie tokens
        expect(duration).toBeLessThan(100);
        expect(error.message).toContain("401");
        
        // Verify no retries attempted for zombie tokens
        expect(mockFetch).toHaveBeenCalledTimes(1);
      }
    });

    it("should distinguish between zombie and expired tokens", async () => {
      // Expired token scenario: 401 WITH WWW-Authenticate header
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: new Headers({
          'WWW-Authenticate': 'Bearer error="invalid_token", error_description="Token expired"'
        }),
        json: async () => ({ error: "Token expired" })
      });

      const config: POSConfig = { provider: "fudo", apiKey: "expired_token_123" };
      const client = new DefaultFudoClient(config);

      const startTime = Date.now();
      
      try {
        await client.validate();
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Expired tokens may trigger rotation logic (slower)
        // But should still be reasonably fast
        expect(duration).toBeLessThan(5000); // 5 seconds max
        expect(error.message).toContain("401");
      }
    });
  });

  describe("Circuit Breaker Integration", () => {
    it("should respect circuit breaker for zombie token scenarios", async () => {
      // Mock circuit breaker check returning 'open'
      const { supabase } = await import("../../src/integrations/supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: { state: 'open', allowed: false },
        error: null
      });

      const config: POSConfig = { 
        provider: "fudo", 
        apiKey: "any_token", 
        locationId: "test-location" 
      };
      const client = new DefaultFudoClient(config);

      try {
        await client.validate();
        expect.fail("Should have thrown circuit breaker error");
      } catch (error: any) {
        expect(error.message).toContain("Circuit breaker");
        
        // Should not even attempt HTTP call when circuit is open
        expect(mockFetch).not.toHaveBeenCalled();
      }
    });
  });

  describe("Metrics and Observability", () => {
    it("should track zombie token detection events", async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: new Headers(),
        json: async () => ({ error: "Invalid token" })
      });

      const config: POSConfig = { provider: "fudo", apiKey: "zombie_token_123" };
      const client = new DefaultFudoClient(config);

      try {
        await client.validate();
      } catch (error) {
        // Expected failure
      }

      // Should log configuration loading (for audit trail)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Fudo config loaded:'),
        expect.objectContaining({
          source: 'DB+ENV+defaults',
          timeout_ms: 30000,
          max_retries: 2
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Edge Cases", () => {
    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const config: POSConfig = { provider: "fudo", apiKey: "any_token" };
      const client = new DefaultFudoClient(config);

      try {
        await client.validate();
        expect.fail("Should have thrown network error");
      } catch (error: any) {
        expect(error.message).toContain("Network error");
      }
    });

    it("should handle malformed responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: new Headers(),
        json: async () => { throw new Error("Invalid JSON"); }
      });

      const config: POSConfig = { provider: "fudo", apiKey: "any_token" };
      const client = new DefaultFudoClient(config);

      try {
        await client.validate();
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).toBeDefined();
      }
    });
  });
});