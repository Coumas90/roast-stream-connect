import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createCryptoMocks } from "./mocks/crypto.mock";

// Import helper functions - we'll need to mock the module
const { classifyError, createTokenFingerprint } = await import("../../../supabase/functions/fudo-rotate-token/index.ts");

describe("Fudo Rotate Token - Helper Functions", () => {
  const cryptoMocks = createCryptoMocks();

  beforeEach(() => {
    cryptoMocks.activate();
  });

  afterEach(() => {
    cryptoMocks.restore();
    cryptoMocks.resetMocks();
  });

  describe("classifyError", () => {
    it("should classify network errors correctly", () => {
      const result = classifyError();
      expect(result.category).toBe("network");
      expect(result.shouldIncrementBreaker).toBe(true);
    });

    it("should classify 5xx errors correctly", () => {
      const result = classifyError(500);
      expect(result.category).toBe("5xx");
      expect(result.shouldIncrementBreaker).toBe(true);
    });

    it("should classify 429 rate limit correctly", () => {
      const result = classifyError(429);
      expect(result.category).toBe("rate_limited");
      expect(result.shouldIncrementBreaker).toBe(true);
    });

    it("should classify 401/403 as invalid credentials", () => {
      const result401 = classifyError(401);
      expect(result401.category).toBe("invalid_credentials");
      expect(result401.shouldIncrementBreaker).toBe(false);

      const result403 = classifyError(403);
      expect(result403.category).toBe("invalid_credentials");
      expect(result403.shouldIncrementBreaker).toBe(false);
    });

    it("should classify 4xx client errors correctly", () => {
      const result = classifyError(400);
      expect(result.category).toBe("client_error");
      expect(result.shouldIncrementBreaker).toBe(false);
    });

    it("should classify 2xx as ok", () => {
      const result = classifyError(200);
      expect(result.category).toBe("ok");
      expect(result.shouldIncrementBreaker).toBe(false);
    });
  });

  describe("createTokenFingerprint", () => {
    it("should create a consistent fingerprint for the same token", async () => {
      const token = "test-token-12345";
      
      const fingerprint1 = await createTokenFingerprint(token);
      const fingerprint2 = await createTokenFingerprint(token);
      
      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toMatch(/^sha256:[a-f0-9]{16}\.\.\.$/);
    });

    it("should create different fingerprints for different tokens", async () => {
      const fingerprint1 = await createTokenFingerprint("token1");
      const fingerprint2 = await createTokenFingerprint("token2");
      
      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it("should handle crypto errors gracefully", async () => {
      cryptoMocks.mockSign.mockRejectedValueOnce(new Error("Crypto error"));
      
      const fingerprint = await createTokenFingerprint("test-token");
      expect(fingerprint).toBe("sha256:unknown...");
    });

    it("should never expose the original token", async () => {
      const sensitiveToken = "super-secret-api-key-12345";
      const fingerprint = await createTokenFingerprint(sensitiveToken);
      
      expect(fingerprint).not.toContain(sensitiveToken);
      expect(fingerprint.length).toBeLessThan(sensitiveToken.length);
    });
  });
});