import type { POSConfig, POSMapper, POSMeta, POSService, POSKind } from "../../../../sdk/pos";
import type { FudoClient } from "./types";
import { DefaultFudoClient } from "./client";
import { toTupaSales as defaultToTupaSales } from "./mapper";

export class FudoService implements POSService {
  readonly meta: POSMeta = {
    id: "fudo",
    label: "Fudo POS",
    name: "Fudo POS",
    version: "1.0.0",
    kindsSupported: ["orders"],
    website: "https://fudo.com/",
    batchLimit: 1000,
    realtime: true,
    capabilities: ["customers", "modifiers", "tables", "realtime"],
  };

  constructor(
    private readonly config: POSConfig,
    private readonly client: FudoClient = new DefaultFudoClient(config),
    private readonly mapper: POSMapper = { toTupaSales: defaultToTupaSales },
  ) {}

  // Fetch a window of sales using cursor-based pagination. Returns total items processed.
  async fetchSalesWindow(params: { from?: string; to?: string; limit?: number }): Promise<number> {
    let cursor: string | undefined = undefined;
    let total = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, nextCursor } = await this.client.fetchSales({ ...params, cursor });
      const sales = this.mapper.toTupaSales?.(data) ?? [];
      total += sales.length;
      if (!nextCursor) break;
      cursor = nextCursor;
    }
    return total;
  }

  async sync(kind: POSKind, since?: string): Promise<number> {
    if (kind !== "orders") throw new Error("FudoService only supports 'orders' sync in v1");
    // For v1, just count mapped results; persistence will be added later
    return this.fetchSalesWindow({ from: since, limit: this.meta.batchLimit });
  }
}

export function fudoFactory(config: POSConfig): POSService {
  return new FudoService(config);
}
