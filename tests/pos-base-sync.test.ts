import { describe, it, expect } from "vitest";
import { BaseSync } from "../src/integrations/pos/sync";
import type { POSMeta, POSService, POSKind } from "../sdk/pos";

class FakePOSService implements POSService {
  readonly meta: POSMeta = { id: "other", label: "Fake", kindsSupported: ["orders"] };
  private attempts = 0;

  async sync(kind: POSKind): Promise<number> {
    if (kind !== "orders") throw new Error("unsupported kind");
    this.attempts++;
    if (this.attempts < 2) {
      throw new Error("temporary failure");
    }
    return 5; // pretend we processed 5 items
  }
}

describe("BaseSync", () => {
  it("retries and succeeds, returning item count", async () => {
    const svc = new FakePOSService();
    const sync = new BaseSync({ retries: 3, baseDelayMs: 1, maxDelayMs: 2, jitter: false });
    const result = await sync.run(() => svc.sync("orders"));

    expect(result.ok).toBe(true);
    expect(result.count).toBe(5);
    expect(result.attempts).toBeGreaterThanOrEqual(2);
  });
});
