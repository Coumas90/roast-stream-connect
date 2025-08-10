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
