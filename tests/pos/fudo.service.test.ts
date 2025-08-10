import { describe, it, expect } from "vitest";
import { FudoService } from "../../../src/integrations/pos/fudo/service";
import type { FudoClient, FudoFetchSalesResponse } from "../../../src/integrations/pos/fudo/types";
import { BaseSync } from "../../../src/integrations/pos/sync";

class StubFudoClient implements FudoClient {
  private calls = 0;
  async validate(): Promise<boolean> { return true; }
  async fetchSales(): Promise<FudoFetchSalesResponse> {
    this.calls++;
    if (this.calls === 1) {
      return { data: [
        { id: "a", created_at: "2025-01-01T10:00:00Z", total: 10, items: [] },
        { id: "b", created_at: "2025-01-01T10:05:00Z", total: 5, items: [] },
        { id: "c", created_at: "2025-01-01T10:10:00Z", total: 7, items: [] },
      ], nextCursor: "next" };
    }
    return { data: [
      { id: "d", created_at: "2025-01-01T10:15:00Z", total: 3, items: [] },
      { id: "e", created_at: "2025-01-01T10:20:00Z", total: 4, items: [] },
    ] };
  }
}

describe("Fudo service + BaseSync", () => {
  it("paginates two pages and returns correct count", async () => {
    const service = new FudoService({ provider: "fudo" }, new StubFudoClient());
    const sync = new BaseSync({ retries: 0 });
    const res = await sync.run(() => service.sync("orders"));

    expect(res.ok).toBe(true);
    expect(res.count).toBe(5);
    expect(service.meta.label).toBe("Fudo POS");
    expect(service.meta.version).toBe("1.0.0");
    expect(service.meta.batchLimit).toBe(1000);
    expect(service.meta.realtime).toBe(true);
    expect(service.meta.capabilities?.length).toBeGreaterThan(0);
  });
});
