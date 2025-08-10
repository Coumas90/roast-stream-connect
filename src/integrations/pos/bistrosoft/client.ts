import type { POSConfig } from "../../../../sdk/pos";
import type { BistroFetchSalesParams, BistroFetchSalesResponse, BistrosoftClient } from "./types";

export class DefaultBistrosoftClient implements BistrosoftClient {
  constructor(private readonly cfg: POSConfig) {}

  async validate(): Promise<boolean> {
    return Boolean(this.cfg.apiKey);
  }

  async fetchSales(_params: BistroFetchSalesParams): Promise<BistroFetchSalesResponse> {
    // Placeholder: real implementation would call Bistrosoft API
    return { data: [], next: undefined };
  }
}
