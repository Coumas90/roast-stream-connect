import type { POSConfig, POSKind, POSMapper, POSMeta, POSService } from "../../../../sdk/pos";
import type { BistrosoftClient } from "./types";
import { DefaultBistrosoftClient } from "./client";
import { toTupaSales as defaultToTupaSales } from "./mapper";

export class BistrosoftService implements POSService {
  readonly meta: POSMeta = {
    id: "bistrosoft",
    label: "Bistrosoft POS",
    name: "Bistrosoft POS",
    version: "1.0.0",
    kindsSupported: ["orders"],
    website: "https://bistrosoft.com/",
    batchLimit: 500,
    realtime: false,
    capabilities: ["customers", "discounts", "tables"],
  };

  constructor(
    private readonly config: POSConfig,
    private readonly client: BistrosoftClient = new DefaultBistrosoftClient(config),
    private readonly mapper: POSMapper = { toTupaSales: defaultToTupaSales },
  ) {}

  async fetchSalesWindow(params: { from?: string; to?: string; limit?: number }): Promise<number> {
    let cursor: string | undefined;
    let total = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, next } = await this.client.fetchSales({ ...params, cursor });
      const sales = this.mapper.toTupaSales?.(data) ?? [];
      total += sales.length;
      if (!next) break;
      cursor = next;
    }
    return total;
  }

  async sync(kind: POSKind, since?: string): Promise<number> {
    if (kind !== "orders") throw new Error("BistrosoftService only supports 'orders' sync in v1");
    return this.fetchSalesWindow({ from: since, limit: this.meta.batchLimit });
  }
}

export function bistrosoftFactory(config: POSConfig): POSService {
  return new BistrosoftService(config);
}
