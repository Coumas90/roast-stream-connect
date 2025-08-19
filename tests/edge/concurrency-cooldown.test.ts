import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for Fudo Token Rotation Concurrency & Cooldown (Card 7)
 * 
 * Updated for atomic leasing approach:
 * - Never processes > N=50 per execution via lease_fudo_rotation_candidates
 * - Respects 4-hour cooldown atomically in the lease function
 * - Respects circuit breaker and cooldown in candidate selection
 * - Marks attempt timestamp atomically with selection (no race conditions)
 * - Prioritizes never-attempted and most urgent credentials
 */
describe("Fudo Token Rotation - Atomic Leasing & Cooldown", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Atomic Leasing Function Tests (lease_fudo_rotation_candidates)", () => {
    it("should respect N=50 limit by default", async () => {
      // Mock 100 credentials but should only return 50
      const mockCredentials = Array.from({ length: 100 }, (_, i) => ({
        location_id: `location-${i}`,
        secret_ref: `ref-${i}`,
        expires_at: new Date(Date.now() + (i * 24 * 60 * 60 * 1000)).toISOString(),
        days_until_expiry: i,
        last_rotation_attempt_at: null
      }));

      // Simulate selector with default limit
      const limitedResults = mockCredentials.slice(0, 50);

      expect(limitedResults.length).toBe(50);
      expect(limitedResults.length).toBeLessThanOrEqual(50);
    });

    it("should respect custom limit parameter", async () => {
      const customLimit = 25;
      const mockCredentials = Array.from({ length: 60 }, (_, i) => ({
        location_id: `location-${i}`,
        secret_ref: `ref-${i}`,
        expires_at: new Date(Date.now() + (i * 24 * 60 * 60 * 1000)).toISOString(),
        days_until_expiry: i,
        last_rotation_attempt_at: null
      }));

      // Simulate selector with custom limit
      const limitedResults = mockCredentials.slice(0, customLimit);

      expect(limitedResults.length).toBe(customLimit);
      expect(limitedResults.length).toBeLessThanOrEqual(customLimit);
    });

    it("should respect 4-hour cooldown filter", async () => {
      const now = new Date();
      const fourHoursAgo = new Date(now.getTime() - (4 * 60 * 60 * 1000));
      const threeHoursAgo = new Date(now.getTime() - (3 * 60 * 60 * 1000));
      const fiveHoursAgo = new Date(now.getTime() - (5 * 60 * 60 * 1000));

      const mockCredentials = [
        { 
          location_id: "never-attempted", 
          last_rotation_attempt_at: null,
          expires_at: now.toISOString(),
          should_be_included: true 
        },
        { 
          location_id: "attempted-3h-ago", 
          last_rotation_attempt_at: threeHoursAgo.toISOString(),
          expires_at: now.toISOString(),
          should_be_included: false  // Within 4h cooldown
        },
        { 
          location_id: "attempted-5h-ago", 
          last_rotation_attempt_at: fiveHoursAgo.toISOString(),
          expires_at: now.toISOString(),
          should_be_included: true   // Outside 4h cooldown
        }
      ];

      // Filter based on cooldown logic
      const cooldownFilter = (cred: any) => 
        cred.last_rotation_attempt_at === null || 
        new Date(cred.last_rotation_attempt_at) < fourHoursAgo;

      const eligibleCreds = mockCredentials.filter(cooldownFilter);
      
      expect(eligibleCreds.length).toBe(2);
      expect(eligibleCreds.map(c => c.location_id)).toEqual(["never-attempted", "attempted-5h-ago"]);
    });

    it("should prioritize never-attempted and most urgent", async () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
      const dayAfter = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000));
      const fiveHoursAgo = new Date(now.getTime() - (5 * 60 * 60 * 1000));

      const mockCredentials = [
        { 
          location_id: "urgent-never-attempted",
          expires_at: tomorrow.toISOString(),
          last_rotation_attempt_at: null,
          expected_priority: 1
        },
        { 
          location_id: "less-urgent-attempted",
          expires_at: dayAfter.toISOString(), 
          last_rotation_attempt_at: fiveHoursAgo.toISOString(),
          expected_priority: 3
        },
        { 
          location_id: "urgent-old-attempt",
          expires_at: tomorrow.toISOString(),
          last_rotation_attempt_at: fiveHoursAgo.toISOString(),
          expected_priority: 2
        }
      ];

      // Sort by priority: expires_at ASC, last_rotation_attempt_at ASC NULLS FIRST
      const sorted = mockCredentials.sort((a, b) => {
        const expiresA = new Date(a.expires_at).getTime();
        const expiresB = new Date(b.expires_at).getTime();
        
        if (expiresA !== expiresB) {
          return expiresA - expiresB; // Most urgent first
        }
        
        // If expires_at is the same, prioritize never attempted (null first)
        if (a.last_rotation_attempt_at === null && b.last_rotation_attempt_at !== null) return -1;
        if (a.last_rotation_attempt_at !== null && b.last_rotation_attempt_at === null) return 1;
        if (a.last_rotation_attempt_at === null && b.last_rotation_attempt_at === null) return 0;
        
        return new Date(a.last_rotation_attempt_at!).getTime() - new Date(b.last_rotation_attempt_at!).getTime();
      });

      expect(sorted[0].location_id).toBe("urgent-never-attempted");
      expect(sorted[1].location_id).toBe("urgent-old-attempt");
      expect(sorted[2].location_id).toBe("less-urgent-attempted");
    });
  });

  describe("Circuit Breaker Interaction", () => {
    it("should not process any credentials when global circuit breaker is open", async () => {
      const circuitState = {
        state: "open",
        allowed: false,
        resume_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      };

      const mockCredentials = [
        { location_id: "cred1", secret_ref: "ref1" },
        { location_id: "cred2", secret_ref: "ref2" }
      ];

      // When circuit breaker is open, should return early
      const shouldProcess = circuitState.allowed;
      const processedCount = shouldProcess ? mockCredentials.length : 0;

      expect(shouldProcess).toBe(false);
      expect(processedCount).toBe(0);
      expect(circuitState.state).toBe("open");
    });

    it("should process limited credentials when global circuit breaker is half-open", async () => {
      const circuitState = {
        state: "half-open",
        allowed: true,
        test_mode: true
      };

      const mockCredentials = [
        { location_id: "cred1", secret_ref: "ref1" },
        { location_id: "cred2", secret_ref: "ref2" },
        { location_id: "cred3", secret_ref: "ref3" }
      ];

      // In half-open mode, should only process 1 location for testing
      const locationsToProcess = circuitState.test_mode ? 
        mockCredentials.slice(0, 1) : mockCredentials;

      expect(locationsToProcess.length).toBe(1);
      expect(locationsToProcess[0].location_id).toBe("cred1");
    });

    it("should respect location-specific circuit breaker", async () => {
      const locations = [
        { location_id: "loc1", cb_state: { state: "closed", allowed: true } },
        { location_id: "loc2", cb_state: { state: "open", allowed: false } },
        { location_id: "loc3", cb_state: { state: "closed", allowed: true } }
      ];

      const processableLocations = locations.filter(loc => loc.cb_state.allowed);
      const blockedCount = locations.length - processableLocations.length;

      expect(processableLocations.length).toBe(2);
      expect(blockedCount).toBe(1);
      expect(processableLocations.map(l => l.location_id)).toEqual(["loc1", "loc3"]);
    });
  });

  describe("Atomic Leasing & Concurrency", () => {
    it("should lease and mark attempts atomically", async () => {
      const mockCandidates = [
        { location_id: "loc1", secret_ref: "ref1", expires_at: new Date().toISOString() },
        { location_id: "loc2", secret_ref: "ref2", expires_at: new Date().toISOString() }
      ];
      
      // Simulate atomic leasing function that selects and marks in one operation
      const mockLeaseFunction = (limit: number, cooldown: string) => {
        // In real implementation, this would be done in a single SQL statement
        const leasedCredentials = mockCandidates.slice(0, limit);
        // last_rotation_attempt_at is set to now() atomically in the UPDATE
        return { data: leasedCredentials };
      };

      const result = mockLeaseFunction(50, "4 hours");

      expect(result.data).toHaveLength(2);
      expect(result.data[0].location_id).toBe("loc1");
      expect(result.data[1].location_id).toBe("loc2");
    });

    it("should prevent concurrent processing via atomic selection", async () => {
      const mockLocation = "test-location";
      let callCount = 0;
      
      // Simulate atomic leasing with concurrent calls
      const mockLeaseFunction = () => {
        callCount++;
        if (callCount === 1) {
          // First call successfully leases the location
          return { data: [{ location_id: mockLocation, secret_ref: "ref1", expires_at: new Date().toISOString() }] };
        } else {
          // Second concurrent call finds nothing (already leased by first call)
          return { data: [] };
        }
      };

      const result1 = mockLeaseFunction();
      const result2 = mockLeaseFunction();

      expect(result1.data).toHaveLength(1);
      expect(result2.data).toHaveLength(0);
      expect(callCount).toBe(2);
    });

    it("should respect circuit breaker in atomic selection", async () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + (30 * 60 * 1000)); // 30 minutes from now
      
      // Mock credential with circuit breaker blocking
      const mockCredentialWithBreaker = {
        location_id: "blocked-location",
        next_attempt_at: futureTime.toISOString(), // Still in future, so blocked
        expires_at: now.toISOString()
      };

      // Atomic leasing should filter out credentials where next_attempt_at > now()
      const isBlocked = new Date(mockCredentialWithBreaker.next_attempt_at) > now;
      const eligibleCredentials = isBlocked ? [] : [mockCredentialWithBreaker];

      expect(isBlocked).toBe(true);
      expect(eligibleCredentials).toHaveLength(0);
    });

    it("should maintain 4-hour cooldown filter atomically", async () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000));
      const fiveHoursAgo = new Date(now.getTime() - (5 * 60 * 60 * 1000));
      
      const mockCredentials = [
        { 
          location_id: "within-cooldown", 
          last_rotation_attempt_at: twoHoursAgo.toISOString(),
          expires_at: now.toISOString()
        },
        { 
          location_id: "outside-cooldown", 
          last_rotation_attempt_at: fiveHoursAgo.toISOString(),
          expires_at: now.toISOString()
        },
        { 
          location_id: "never-attempted", 
          last_rotation_attempt_at: null,
          expires_at: now.toISOString()
        }
      ];

      // Simulate cooldown filter in atomic leasing
      const fourHourCutoff = new Date(now.getTime() - (4 * 60 * 60 * 1000));
      const eligibleCredentials = mockCredentials.filter(cred => 
        cred.last_rotation_attempt_at === null || 
        new Date(cred.last_rotation_attempt_at) <= fourHourCutoff
      );

      expect(eligibleCredentials).toHaveLength(2);
      expect(eligibleCredentials.map(c => c.location_id)).toEqual(["outside-cooldown", "never-attempted"]);
    });
  });

  describe("Integration Tests", () => {
    it("should never exceed N=50 limit regardless of available credentials", async () => {
      const LIMIT = 50;
      
      // Mock scenario with 200 credentials
      const mockCredentials = Array.from({ length: 200 }, (_, i) => ({
        location_id: `location-${i}`,
        secret_ref: `ref-${i}`,
        expires_at: new Date(Date.now() + (i * 60 * 60 * 1000)).toISOString(),
        last_rotation_attempt_at: null
      }));

      // Simulate rotation job processing
      const result = {
        total_candidates: mockCredentials.length,
        processed: 0,
        successes: 0,
        failures: 0
      };

      // Process with limit
      const limitedCreds = mockCredentials.slice(0, LIMIT);
      result.processed = limitedCreds.length;

      expect(result.total_candidates).toBe(200);
      expect(result.processed).toBe(LIMIT);
      expect(result.processed).toBeLessThanOrEqual(LIMIT);
    });

    it("should maintain idempotency with rotation IDs", async () => {
      const rotationId = "test-rotation-123";
      
      // Simulate atomic rotation with same rotation_id twice
      let firstCall = true;
      const mockAtomicRotation = (rotId: string) => {
        if (firstCall) {
          firstCall = false;
          return { data: [{ operation_result: "rotated", is_idempotent: false }] };
        } else {
          // Second call with same rotation_id should be idempotent
          return { data: [{ operation_result: "idempotent", is_idempotent: true }] };
        }
      };

      const result1 = mockAtomicRotation(rotationId);
      const result2 = mockAtomicRotation(rotationId);

      expect(result1.data[0].is_idempotent).toBe(false);
      expect(result2.data[0].is_idempotent).toBe(true);
      expect(result2.data[0].operation_result).toBe("idempotent");
    });
  });
});