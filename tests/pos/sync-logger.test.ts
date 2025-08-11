
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de supabase client
vi.mock("@/integrations/supabase/client", () => {
  const state: { row: any | null } = { row: null };
  const invokeMock = vi.fn(async (_name: string, _args: any) => ({ data: {}, error: null }));
  return {
    supabase: {
      from: (_table: string) => ({
        select: (_cols: string) => ({
          match: (_m: Record<string, any>) => ({
            maybeSingle: async () => ({ data: state.row, error: null }),
          }),
        }),
      }),
      functions: {
        invoke: invokeMock,
      },
      // helpers for tests
      __setStatusRow: (row: any | null) => (state.row = row),
      __getInvokeMock: () => invokeMock,
    },
  };
});

import { canSync, startSync, logError, logSuccess } from "@/integrations/pos/sync-logger";
import { supabase as mockedSb } from "@/integrations/supabase/client";

class FixedNow extends Date {
  private static fixed = 0;
  constructor() {
    super(FixedNow.fixed);
  }
  static set(t: number) {
    FixedNow.fixed = t;
  }
}

describe("sync-logger", () => {
  beforeEach(() => {
    (mockedSb as any).__setStatusRow(null);
    (mockedSb as any).__getInvokeMock().mockReset();
  });

  it("canSync returns ok:false with waitMs when paused_until is in the future", async () => {
    const base = Date.now();
    FixedNow.set(base);
    const paused = new Date(base + 60_000).toISOString();
    (mockedSb as any).__setStatusRow({ paused_until: paused, next_attempt_at: null });

    const res = await canSync({
      locationId: "loc1",
      provider: "fudo",
      now: FixedNow as unknown as typeof Date,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("paused_until");
      expect(res.waitMs).toBeGreaterThanOrEqual(59_000);
      expect(res.waitMs).toBeLessThanOrEqual(61_000);
    }
  });

  it("canSync returns ok:false with waitMs when next_attempt_at is in the future", async () => {
    const base = Date.now();
    FixedNow.set(base);
    const next = new Date(base + 30_000).toISOString();
    (mockedSb as any).__setStatusRow({ paused_until: null, next_attempt_at: next });

    const res = await canSync({
      locationId: "loc1",
      provider: "fudo",
      now: FixedNow as unknown as typeof Date,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("backoff");
      expect(res.waitMs).toBeGreaterThanOrEqual(29_000);
      expect(res.waitMs).toBeLessThanOrEqual(31_000);
    }
  });

  it("logError increments failures and sets nextAttemptAt and pausedUntil at >=5 (from function response)", async () => {
    const invoke = (mockedSb as any).__getInvokeMock();
    const base = Date.now();
    const next = new Date(base + 120_000).toISOString();
    const paused = new Date(base + 2 * 60 * 60 * 1000).toISOString();

    invoke.mockResolvedValueOnce({
      data: { failures: 5, nextAttemptAt: next, pausedUntil: paused },
      error: null,
    });

    const res = await logError("run-1", { error: "boom", durationMs: 1234 });
    expect(invoke).toHaveBeenCalled();
    expect(res.failures).toBe(5);
    expect(new Date(res.nextAttemptAt).getTime()).toBe(new Date(next).getTime());
    expect(res.pausedUntil).toBe(paused);
  });

  it("logSuccess resets failures and returns lastRunAt (from function response)", async () => {
    const invoke = (mockedSb as any).__getInvokeMock();
    const lastRunAt = new Date().toISOString();
    invoke.mockResolvedValueOnce({
      data: { failures: 0, lastRunAt },
      error: null,
    });

    const res = await logSuccess("run-2", { count: 10, durationMs: 456 });
    expect(invoke).toHaveBeenCalled();
    expect(res.failures).toBe(0);
    expect(res.lastRunAt).toBe(lastRunAt);
  });

  it("startSync returns runId from function", async () => {
    const invoke = (mockedSb as any).__getInvokeMock();
    invoke.mockResolvedValueOnce({
      data: { runId: "abc-123" },
      error: null,
    });

    const { runId } = await startSync({ locationId: "loc1", provider: "fudo" });
    expect(runId).toBe("abc-123");
  });
});

