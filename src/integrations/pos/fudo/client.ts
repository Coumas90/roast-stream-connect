import type { POSConfig } from "../../../../sdk/pos";
import type { FudoClient, FudoFetchSalesParams, FudoFetchSalesResponse } from "./types";

export class DefaultFudoClient implements FudoClient {
  constructor(private readonly cfg: POSConfig) {}

  async validate(): Promise<boolean> {
    // Dummy validation for now (no network hit)
    return Boolean(this.cfg.apiKey);
  }

  async fetchSales(_params: FudoFetchSalesParams): Promise<FudoFetchSalesResponse> {
    // Placeholder: real implementation would call Fudo API with pagination
    return { data: [], nextCursor: undefined };
  }
}
