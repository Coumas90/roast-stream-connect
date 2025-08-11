import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks
vi.mock("@/integrations/pos/sync-logger", () => {
  return {
    canSync: vi.fn(async () => ({ ok: true })),
    startSync: vi.fn(async () => ({ runId: "run-123" })),
    logSuccess: vi.fn(async () => ({ failures: 0, lastRunAt: new Date().toISOString() })),
    logError: vi.fn(async () => ({ failures: 1, nextAttemptAt: new Date(Date.now() + 60_000).toISOString() })),
  };
});

vi.mock("@/integrations/pos/registry", () => {
  // Service stub with 2 "pages" internally aggregated
  const sales = [
    { external_id: "o1", occurred_at: new Date().toISOString(), total: 10, items: [{ qty: 1, price: 10 }] },
    { external_id: "o2", occurred_at: new Date().toISOString(), total: 20, items: [{ qty: 2, price: 10 }] },
    { external_id: "o3", occurred_at: new Date().toISOString(), total: 5, items: [{ qty: 1, price: 5 }] },
  ];
  const service = {
    fetchSalesWindow: vi.fn(async (_range: any) => {
      // emulate 2 pages merged inside the adapter
      return sales;
    }),
  };
  return {
    getPOSAdapter: vi.fn(() => service),
    __service: service,
  };
});

vi.mock("@/integrations/consumption/consumption.rpc", () => {
  return {
    upsertConsumptionRpc: vi.fn(async () => ({ id: "c-1" })),
  };
});

// Minimal supabase client placeholder used by upsertConsumptionRpc
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { runPOSSync } from "@/integrations/pos/sync";
import * as logger from "@/integrations/pos/sync-logger";
import { getPOSAdapter } from "@/integrations/pos/registry";
import { upsertConsumptionRpc } from "@/integrations/consumption/consumption.rpc";

const asMock = (fn: any) => fn as unknown as ReturnType<typeof vi.fn>;

describe("runPOSSync", () => {
  beforeEach(() => {
    asMock((logger as any).canSync).mockReset().mockResolvedValue({ ok: true });
    asMock((logger as any).startSync).mockReset().mockResolvedValue({ runId: "run-xyz" });
    asMock((logger as any).logSuccess).mockReset();
    asMock((logger as any).logError).mockReset();
    asMock((getPOSAdapter as any)).mockClear();
    asMock((upsertConsumptionRpc as any)).mockReset();
  });

  it("skips when canSync=false (backoff)", async () => {
    asMock((logger as any).canSync).mockResolvedValueOnce({ ok: false, reason: "backoff", waitMs: 30000 });

    const res = await runPOSSync({
      clientId: "t1",
      locationId: "loc1",
      provider: "fudo" as any,
      range: { from: "2025-01-01", to: "2025-01-02" },
    });

    expect(res).toEqual({ skipped: true, reason: "backoff", waitMs: 30000 });
    expect(asMock((logger as any).startSync)).not.toHaveBeenCalled();
    expect(asMock((upsertConsumptionRpc as any))).not.toHaveBeenCalled();
  });

  it("runs, aggregates, persists consumption and logs success", async () => {
    const res = await runPOSSync({
      clientId: "t1",
      locationId: "loc1",
      provider: "fudo" as any,
      range: { from: "2025-01-01", to: "2025-01-02" },
      dryRun: false,
    });

    expect(asMock((logger as any).startSync)).toHaveBeenCalled();
    expect(asMock((getPOSAdapter as any))).toHaveBeenCalled();
    expect(asMock((upsertConsumptionRpc as any))).toHaveBeenCalledTimes(1);
    expect(asMock((logger as any).logSuccess)).toHaveBeenCalled();

    expect((res as any).runId).toBeDefined();
    expect((res as any).count).toBeGreaterThan(0);
  });

  it("logs error and rethrows on adapter failure", async () => {
    // Make adapter throw
    const adapter = (getPOSAdapter as any)();
    asMock(adapter.fetchSalesWindow).mockRejectedValueOnce(new Error("fail"));

    await expect(
      runPOSSync({ clientId: "t1", locationId: "loc1", provider: "fudo" as any, range: { to: "2025-01-02" } })
    ).rejects.toThrow(/fail/);

    expect(asMock((logger as any).logError)).toHaveBeenCalled();
  });
});
