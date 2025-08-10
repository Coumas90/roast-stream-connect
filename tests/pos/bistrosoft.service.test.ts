import { describe, it, expect } from "vitest";
import { BistrosoftService } from "../../../src/integrations/pos/bistrosoft/service";
import type { BistrosoftClient, BistroFetchSalesResponse } from "../../../src/integrations/pos/bistrosoft/types";
import { BaseSync } from "../../../src/integrations/pos/sync";

class StubBistroClient implements BistrosoftClient {
  private calls = 0;
  async validate(): Promise<boolean> { return true; }
  async fetchSales(): Promise<BistroFetchSalesResponse> {
    this.calls++;
    if (this.calls === 1) {
      return { data: [
        { id: "x1", datetime: "2025-02-01T12:00:00Z", total: 12, lines: [] },
        { id: "x2", datetime: "2025-02-01T12:05:00Z", total: 8, lines: [] },
      ], next: "p2" };
    }
    return { data: [ { id: "x3", datetime: "2025-02-01T12:10:00Z", total: 5, lines: [] } ] };
  }
}

describe("Bistrosoft service + BaseSync", () => {
  it("paginates two pages and returns correct count", async () => {
    const service = new BistrosoftService({ provider: "bistrosoft" }, new StubBistroClient());
    const sync = new BaseSync({ retries: 0 });
    const res = await sync.run(() => service.sync("orders"));

    expect(res.ok).toBe(true);
    expect(res.count).toBe(3);
    expect(service.meta.label).toBe("Bistrosoft POS");
    expect(service.meta.version).toBe("1.0.0");
    expect(service.meta.batchLimit).toBe(500);
    expect(service.meta.realtime).toBe(false);
    expect(service.meta.capabilities?.includes("discounts")).toBe(true);
  });
});
