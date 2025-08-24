import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadFudoConfig, DEFAULT_FUDO_CONFIG } from "../../src/integrations/pos/fudo/config";

// Mock Supabase client
const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockIlike = vi.fn(() => ({ select: mockSelect }));

vi.mock("../../src/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom
  }
}));

describe("Fudo Configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset environment variables
    delete process.env.FUDO_API_TIMEOUT_MS;
    delete process.env.FUDO_MAX_RETRIES;
    delete process.env.FUDO_CB_THRESHOLD;
    
    // Setup default mock chain
    mockSelect.mockReturnValue({
      ilike: mockIlike
    });
    mockIlike.mockResolvedValue({
      data: [],
      error: null
    });
  });

  describe("Default Configuration", () => {
    it("should provide safe defaults when no DB or ENV settings", async () => {
      mockIlike.mockResolvedValue({ data: [], error: null });
      
      const config = await loadFudoConfig();
      
      expect(config).toEqual(DEFAULT_FUDO_CONFIG);
      expect(config.API_TIMEOUT_MS).toBe(30000);
      expect(config.MAX_RETRIES).toBe(2);
      expect(config.CB_THRESHOLD).toBe(10);
    });
  });

  describe("Database Settings Priority", () => {
    it("should load settings from pos_settings table", async () => {
      const dbSettings = [
        { key: "fudo_api_timeout_ms", value: 25000 },
        { key: "fudo_max_retries", value: 1 },
        { key: "fudo_cb_threshold", value: 5 }
      ];
      
      mockIlike.mockResolvedValue({ data: dbSettings, error: null });
      
      const config = await loadFudoConfig();
      
      expect(config.API_TIMEOUT_MS).toBe(25000);
      expect(config.MAX_RETRIES).toBe(1);
      expect(config.CB_THRESHOLD).toBe(5);
    });

    it("should handle database errors gracefully", async () => {
      mockIlike.mockResolvedValue({ 
        data: null, 
        error: new Error("Database connection failed") 
      });
      
      const config = await loadFudoConfig();
      
      // Should fall back to defaults
      expect(config).toEqual(DEFAULT_FUDO_CONFIG);
    });
  });

  describe("Environment Variable Override", () => {
    it("should override DB settings with ENV vars", async () => {
      process.env.FUDO_API_TIMEOUT_MS = "45000";
      process.env.FUDO_MAX_RETRIES = "3";
      
      const dbSettings = [
        { key: "fudo_api_timeout_ms", value: 25000 },
        { key: "fudo_max_retries", value: 1 }
      ];
      
      mockIlike.mockResolvedValue({ data: dbSettings, error: null });
      
      const config = await loadFudoConfig();
      
      expect(config.API_TIMEOUT_MS).toBe(45000); // ENV override
      expect(config.MAX_RETRIES).toBe(3); // ENV override
      expect(config.CB_THRESHOLD).toBe(10); // Default (no DB or ENV)
    });

    it("should ignore invalid environment values", async () => {
      process.env.FUDO_API_TIMEOUT_MS = "invalid_number";
      process.env.FUDO_MAX_RETRIES = "NaN";
      
      mockIlike.mockResolvedValue({ data: [], error: null });
      
      const config = await loadFudoConfig();
      
      // Should use defaults when ENV is invalid
      expect(config.API_TIMEOUT_MS).toBe(30000);
      expect(config.MAX_RETRIES).toBe(2);
    });
  });

  describe("Configuration Governance", () => {
    it("should follow DB → ENV → Defaults precedence correctly", async () => {
      // Set ENV
      process.env.FUDO_API_TIMEOUT_MS = "35000";
      
      // Set DB (should be overridden by ENV)
      const dbSettings = [
        { key: "fudo_api_timeout_ms", value: 25000 },
        { key: "fudo_cb_threshold", value: 15 } // No ENV override
      ];
      
      mockIlike.mockResolvedValue({ data: dbSettings, error: null });
      
      const config = await loadFudoConfig();
      
      expect(config.API_TIMEOUT_MS).toBe(35000); // ENV wins
      expect(config.CB_THRESHOLD).toBe(15); // DB value used
      expect(config.MAX_RETRIES).toBe(2); // Default used
    });
  });

  describe("Numerical Consistency", () => {
    it("should align with circuit breaker threshold", async () => {
      const config = await loadFudoConfig();
      
      // Should match existing circuit breaker logic (10 failures = open)
      expect(config.CB_THRESHOLD).toBe(10);
    });

    it("should align with edge function timeouts", async () => {
      const config = await loadFudoConfig();
      
      // Should match Supabase edge function timeout (30s standard)
      expect(config.API_TIMEOUT_MS).toBe(30000);
    });

    it("should align with chaos test parameters", async () => {
      const config = await loadFudoConfig();
      
      // Should match retry count used in chaos tests
      expect(config.MAX_RETRIES).toBe(2);
      expect(config.BACKOFF_MS).toBe(1000);
    });
  });

  describe("Configuration Caching", () => {
    it("should cache settings for performance", async () => {
      mockIlike.mockResolvedValue({ data: [], error: null });
      
      // First call
      await loadFudoConfig();
      
      // Second call (should use cache)
      await loadFudoConfig();
      
      // Should only call DB once
      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockIlike).toHaveBeenCalledTimes(1);
    });
  });
});