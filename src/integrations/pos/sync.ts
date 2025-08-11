export interface BaseSyncOptions {
  retries?: number; // number of retries after the first try
  baseDelayMs?: number; // initial backoff delay
  maxDelayMs?: number; // max backoff delay
  jitter?: boolean; // add random jitter
}

export interface SyncResult {
  ok: boolean;
  attempts: number; // total attempts performed
  count: number; // items processed on success, 0 on failure
  error?: string; // last error message if failed
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export function backoffDelay(attempt: number, base: number, max: number, jitter = true): number {
  const exp = Math.min(max, base * Math.pow(2, attempt));
  if (!jitter) return exp;
  const rand = Math.random() * 0.4 + 0.8; // 0.8x - 1.2x jitter
  return Math.min(max, Math.floor(exp * rand));
}

export class BaseSync {
  private readonly retries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly jitter: boolean;

  constructor(opts: BaseSyncOptions = {}) {
    this.retries = opts.retries ?? 3;
    this.baseDelayMs = opts.baseDelayMs ?? 500;
    this.maxDelayMs = opts.maxDelayMs ?? 2000;
    this.jitter = opts.jitter ?? true;
  }

  // Runs the provided async operation with retry + exponential backoff. The operation
  // should return the number of processed items when successful.
  async run(operation: () => Promise<number>): Promise<SyncResult> {
    let attempt = 0;
    let lastErr: unknown = null;

    while (attempt <= this.retries) {
      try {
        const count = await operation();
        return { ok: true, attempts: attempt + 1, count };
      } catch (err) {
        lastErr = err;
        if (attempt === this.retries) break;
        const delay = backoffDelay(attempt, this.baseDelayMs, this.maxDelayMs, this.jitter);
        await sleep(delay);
        attempt++;
      }
    }

    return { ok: false, attempts: attempt + 1, count: 0, error: String((lastErr as any)?.message ?? lastErr) };
  }
}

// --- POS Sync Orchestration (2.3) ---
import type { AppPosProvider } from "@/integrations/supabase/pos-types";
import { getPOSAdapter } from "./registry";
import type { TupaSale } from "../../../sdk/pos";
import { supabase } from "@/integrations/supabase/client";
import { upsertConsumptionRpc } from "@/integrations/consumption/consumption.rpc";
import { aggregateSalesToConsumption } from "@/integrations/consumption/consumption";
import * as logger from "@/integrations/pos/sync-logger";

export type SalesRange = { from?: string; to?: string; limit?: number };

export type RunPOSSyncInput = {
  clientId: string;
  locationId: string;
  provider: AppPosProvider;
  range: SalesRange;
  dryRun?: boolean;
};

export type RunPOSSyncResult =
  | { skipped: true; reason: string; waitMs: number }
  | { skipped?: false; runId: string; count: number };

export async function runPOSSync({ clientId, locationId, provider, range, dryRun = false }: RunPOSSyncInput): Promise<RunPOSSyncResult> {
  const can = await logger.canSync({ clientId, locationId, provider, now: Date });
  if (!can.ok) {
    const r = can as { ok: false; reason: string; waitMs: number };
    return { skipped: true, reason: r.reason, waitMs: r.waitMs };
  }

  const t0 = Date.now();
  const { runId } = await logger.startSync({ clientId, locationId, provider });

  try {
    // Instantiate adapter (config resolution TBD; pass minimal info)
    const service: any = getPOSAdapter(provider as any, { provider, locationId });

    // Expect adapter to return TupaSale[]; if it returns a number, we cannot aggregate yet.
    const maybeSales: unknown = await service.fetchSalesWindow?.({ from: range.from, to: range.to, limit: range.limit });
    if (!Array.isArray(maybeSales)) {
      throw new Error("Adapter returned no sales list; expected TupaSale[] from fetchSalesWindow");
    }
    const sales = maybeSales as TupaSale[];

    const consumption = aggregateSalesToConsumption({
      clientId,
      locationId,
      provider,
      date: range.to,
      sales,
    });

    if (!dryRun) {
      await upsertConsumptionRpc(supabase, consumption as any);
    }

    const durationMs = Date.now() - t0;
    await logger.logSuccess(runId, { count: sales.length, durationMs });
    return { runId, count: sales.length };
  } catch (e) {
    const durationMs = Date.now() - t0;
    await logger.logError(runId, { error: String((e as any)?.message ?? e), durationMs });
    throw e;
  }
}

