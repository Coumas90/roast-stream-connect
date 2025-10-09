// SDK POS Types and Contracts
// Keep this file minimal and framework-agnostic so it can be reused from app or functions

export type POSKind = "products" | "orders" | "sales";

export type POSProviderId = "fudo" | "maxirest" | "bistrosoft" | "other" | (string & {});

/**
 * Basic configuration required to create a POS adapter.
 * Additional provider-specific options can be supplied via extra keys.
 */
export interface POSConfig {
  /** Identifier of the POS provider implementation. */
  provider: POSProviderId;
  /** API key or token used for authenticating with the provider. */
  apiKey?: string;
  /** Optional location identifier when the provider supports multiple stores. */
  locationId?: string;
  /** Allow provider-specific settings without breaking typing. */
  [k: string]: unknown;
}

export interface TupaSaleItem {
  sku?: string;
  name?: string;
  qty?: number;
  price?: number; // unit price
}

export interface TupaSale {
  external_id: string; // provider order id
  occurred_at: string; // ISO timestamp
  total: number;
  status?: string;
  items?: TupaSaleItem[];
  meta?: Record<string, unknown>;
}

// Low-level client that fetches raw provider data
export interface POSClient {
  getOrders?(since?: string): Promise<unknown[]>;
  getProducts?(since?: string): Promise<unknown[]>;
}

// Mapper from provider payloads to TUPÁ domain models
export interface POSMapper {
  toTupaSales?(raw: unknown[]): TupaSale[];
  // Future: toTupaProducts?(raw: unknown[]): TupaProduct[];
}

export interface POSMeta {
  id: POSProviderId;
  label: string;
  kindsSupported: POSKind[];
  website?: string;
  version?: string;
  // Extended optional metadata for richer capabilities
  name?: string;
  batchLimit?: number;
  realtime?: boolean;
  capabilities?: string[];
}


/**
 * High-level service used by the app to perform sync tasks against a POS.
 */
export interface POSService {
  /** Static metadata describing the adapter implementation. */
  readonly meta: POSMeta;
  /**
   * Synchronize data for a given entity kind.
   *
   * @param kind - Type of entity to synchronize (e.g. "sales").
   * @param since - Optional ISO timestamp to resume incremental syncs.
   * @returns Number of items processed.
   */
  sync(kind: POSKind, since?: string): Promise<number>;
}

export type POSAdapterFactory = (config: POSConfig) => POSService;
