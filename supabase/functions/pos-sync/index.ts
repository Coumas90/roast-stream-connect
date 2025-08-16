/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptAESGCM, type CipherBundle } from "../_shared/crypto.ts";
import { withCORS, requireSecureAuth } from "../_shared/cors.ts";
import { buildAllowlist } from "../_shared/patterns.ts";

// Types mirrored from app
type AppPosProvider = "fudo" | "maxirest" | "bistrosoft" | "other";

// Read env safely (so tests can run under Node by stubbing globalThis.Deno)
const D = (globalThis as any).Deno;
const SUPABASE_URL: string = D?.env?.get("SUPABASE_URL") ?? "";
const SERVICE_KEY: string = D?.env?.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY: string = D?.env?.get("SUPABASE_ANON_KEY") ?? "";
const JOB_TOKEN: string = D?.env?.get("POS_SYNC_JOB_TOKEN") ?? "";
const KMS_HEX: string = D?.env?.get("POS_CRED_KMS_KEY") ?? "";

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function isYYYYMMDD(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function toDateUTC(day: string): Date {
  const [y, m, d] = day.split("-").map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

function yyyymmddUTC(d = new Date()): string {
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return u.toISOString().slice(0, 10);
}

function yesterdayUTC(): string {
  const u = new Date();
  u.setUTCDate(u.getUTCDate() - 1);
  return yyyymmddUTC(u);
}

function diffDaysInclusive(a: string, b: string): number {
  const da = toDateUTC(a).getTime();
  const db = toDateUTC(b).getTime();
  const diff = Math.round((db - da) / (24 * 60 * 60 * 1000));
  return diff + 1; // inclusive
}

async function authorize(req: Request): Promise<{ ok: true; mode: "job" | "admin" } | { ok: false }> {
  // X-Job-Token path
  const tok = req.headers.get("X-Job-Token") ?? req.headers.get("x-job-token") ?? "";
  if (JOB_TOKEN && tok && safeEqual(JOB_TOKEN, tok)) return { ok: true, mode: "job" };

  // Admin JWT path
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const userClient = createClient(SUPABASE_URL || "", ANON_KEY || "anon", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: auth } },
    });
    const { data, error } = await (userClient.rpc as any)("is_tupa_admin");
    if (!error && data === true) return { ok: true, mode: "admin" };
  }
  return { ok: false };
}

async function canSync(svc: any, locationId: string, provider: AppPosProvider): Promise<{ ok: true } | { ok: false; reason: string; waitMs: number }> {
  const { data, error } = await svc
    .from("pos_sync_status")
    .select("paused_until,next_attempt_at")
    .match({ location_id: locationId, provider })
    .maybeSingle();

  if (error) return { ok: true };
  const now = Date.now();
  const paused = data?.paused_until ? new Date(data.paused_until).getTime() : null;
  if (paused && paused > now) return { ok: false, reason: "paused_until", waitMs: paused - now };
  const next = data?.next_attempt_at ? new Date(data.next_attempt_at).getTime() : null;
  if (next && next > now) return { ok: false, reason: "backoff", waitMs: next - now };
  return { ok: true };
}

// Network helper with timeout
async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 10000, ...rest } = init as any;
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: ac.signal } as any);
  } finally {
    clearTimeout(id);
  }
}

function fudoBaseAuth(env?: string) {
  return (env ?? "production").toLowerCase() === "staging" ? "https://auth.staging.fu.do/api" : "https://auth.fu.do/api";
}
function fudoBaseApi(env?: string) {
  const override = (globalThis as any)?.Deno?.env?.get?.("FUDO_API_BASE");
  if (override) return override;
  return (env ?? "production").toLowerCase() === "staging" ? "https://api.staging.fu.do/v1alpha1" : "https://api.fu.do/v1alpha1";
}

export async function fudoGetToken(params: { apiKey: string; apiSecret: string; env?: string }) {
  const { apiKey, apiSecret, env } = params;
  const url = fudoBaseAuth(env);
  const body = JSON.stringify({ apiKey, apiSecret });
  const call = () => fetchWithTimeout(url, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body, timeoutMs: 10000 });
  let resp: Response | null = null;
  try { resp = await call(); } catch { resp = await call(); }
  if (!resp) throw Object.assign(new Error("provider_unreachable"), { status: 502 });
  if (resp.status === 200) {
    try { return await resp.json(); } catch { return { token: "", exp: 0 }; }
  }
  if (resp.status === 401 || resp.status === 403) throw Object.assign(new Error("unauthorized"), { status: resp.status });
  throw Object.assign(new Error("provider_error"), { status: 502 });
}

export async function fudoFetchSalesWindow(params: { from: string; to: string; token: string; env?: string }) {
  const { from, to, token, env } = params;
  const base = fudoBaseApi(env);
  const pageSize = 500;
  const maxPages = 50;
  let page = 1;
  let total = 0;
  let sales: Array<{ total?: number; items?: Array<{ quantity?: number }>; occurred_at?: string } > = [];
  while (page <= maxPages) {
    const url = new URL(`${base}/sales`);
    url.searchParams.set("page[size]", String(pageSize));
    url.searchParams.set("page[number]", String(page));
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
    const call = () => fetchWithTimeout(url.toString(), { headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, timeoutMs: 12000 });
    let resp: Response | null = null;
    try { resp = await call(); } catch { resp = await call(); }
    if (!resp) throw Object.assign(new Error("provider_unreachable"), { status: 502 });
    if (resp.status === 401 || resp.status === 403) throw Object.assign(new Error("AUTH_401"), { status: resp.status, code: "AUTH_401" });
    if (resp.status >= 500 || resp.status === 429) {
      // one soft retry already done in call(); if still failing, break
      break;
    }
    if (resp.status !== 200) break;
    let data: any = null;
    try { data = await resp.json(); } catch { data = null; }
    const arr = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    total = arr.length;
    sales = sales.concat(
      arr.map((s: any) => ({ total: Number(s?.total ?? 0), items: Array.isArray(s?.items) ? s.items : [], occurred_at: s?.created_at ?? s?.occurred_at }))
    );
    if (arr.length < pageSize) break;
    page += 1;
  }
  return sales;
}

export async function handlePosSyncRequest(
  req: Request,
  deps?: { svc?: any; kmsHex?: string }
) {
  const svc = deps?.svc ?? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const kmsHex = deps?.kmsHex ?? KMS_HEX;

  // Enhanced auth check for orchestration endpoint
  const authCheck = requireSecureAuth(req, [JOB_TOKEN]);
  if (!authCheck.ok) {
    return new Response(
      JSON.stringify({ error: authCheck.error || "forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const payload = await req.json().catch(() => ({} as any));
  const { clientId, locationId, provider, range, dryRun } = payload ?? {};

  if (!isUUID(clientId ?? "") || !isUUID(locationId ?? "")) {
    return new Response(
      JSON.stringify({ error: "invalid uuid" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!( ["fudo", "bistrosoft", "maxirest", "other"] as const).includes(provider)) {
    return new Response(
      JSON.stringify({ error: "invalid provider" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let from: string;
  let to: string;
  if (!range) {
    from = to = yesterdayUTC();
    } else {
    from = range.from ?? yesterdayUTC();
    to = range.to ?? from;
  }
  if (!isYYYYMMDD(from) || !isYYYYMMDD(to)) {
    return new Response(
      JSON.stringify({ error: "invalid range format" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (toDateUTC(from).getTime() > toDateUTC(to).getTime()) {
    return new Response(
      JSON.stringify({ error: "from>to" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (diffDaysInclusive(from, to) > 31) {
    return new Response(
      JSON.stringify({ error: "range too large (max 31 days)" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!kmsHex || !/^[0-9a-fA-F]{64}$/.test(kmsHex)) {
    return new Response(
      JSON.stringify({ error: "kms_misconfigured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: credRow, error: credErr } = await svc
    .from("pos_provider_credentials")
    .select("ciphertext,status")
    .eq("location_id", locationId)
    .eq("provider", provider)
    .maybeSingle();

  if (credErr) {
    return new Response(
      JSON.stringify({ error: "db_error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!credRow) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "no_credentials" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (credRow.status === "invalid") {
    return new Response(
      JSON.stringify({ skipped: true, reason: "invalid_credentials" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  let credentials: Record<string, unknown>;
  try {
    const bundle = JSON.parse(credRow.ciphertext) as CipherBundle;
    credentials = (await decryptAESGCM(kmsHex, bundle)) as Record<string, unknown>;
  } catch {
    return new Response(
      JSON.stringify({ error: "ciphertext_invalid" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Provider-specific precheck
  let fudoToken: string | null = null;
  let env: string | undefined = typeof credentials["env"] === "string" ? String(credentials["env"]) : undefined;
  if (provider === "fudo") {
    const apiSecret = typeof credentials["apiSecret"] === "string" ? String(credentials["apiSecret"]).trim() : "";
    const ak = typeof credentials["apiKey"] === "string" ? String(credentials["apiKey"]).trim() : "";
    try {
      const tok = await fudoGetToken({ apiKey: ak, apiSecret, env });
      fudoToken = String((tok as any)?.token ?? "");
      if (!fudoToken) throw new Error("invalid token");
    } catch (e: any) {
      const status = e?.status ?? e?.code;
      if (status === 401 || status === 403) {
        await svc
          .from("pos_provider_credentials")
          .update({ status: "invalid", last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("location_id", locationId)
          .eq("provider", provider);
        return new Response(
          JSON.stringify({ skipped: true, reason: "invalid_credentials" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ skipped: true, reason: "provider_unreachable" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  } else {
    // Pre-validate credentials (lightweight) for non-Fudo providers
    const ak = typeof credentials["apiKey"] === "string" ? String(credentials["apiKey"]).trim() : "";
    let unauthorized = false;
    if (provider === "bistrosoft") unauthorized = !(ak.startsWith("bs_") && ak.length >= 4);
    else if (provider === "maxirest") unauthorized = !(/[A-Z0-9]{8,}/.test(ak));
    else unauthorized = ak.length < 6;
    if (unauthorized) {
      await svc
        .from("pos_provider_credentials")
        .update({ status: "invalid", last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("location_id", locationId)
        .eq("provider", provider);
      return new Response(
        JSON.stringify({ skipped: true, reason: "invalid_credentials" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Backoff/autopause gate (only after valid credentials)
  const can = await canSync(svc, locationId, provider);
  if (!can.ok) {
    return new Response(
      JSON.stringify({ skipped: true, reason: can.reason, waitMs: can.waitMs }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Start run via logger (only now do we generate correlation_id)
  const correlation_id = crypto.randomUUID();
  const t0 = Date.now();
  const startResp = await svc.functions.invoke("pos-sync-logger", {
    body: { action: "start", clientId: null, locationId, provider, meta: { correlation_id } },
  });
  if (startResp.error) {
    return new Response(
      JSON.stringify({ error: startResp.error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const runId = (startResp.data as any)?.runId as string;

  try {
    // Real sync aggregation
    let count = 0;
    let total = 0;
    let orders = 0;
    let items = 0;
    const discounts = 0;
    const taxes = 0;

    if (provider === "fudo") {
      const sales = await fudoFetchSalesWindow({ from, to, token: fudoToken as string, env });
      count = sales.length;
      orders = count;
      total = sales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
      items = sales.reduce((acc, s) => acc + (Array.isArray(s.items) ? s.items.reduce((n, it) => n + (Number(it?.quantity ?? 0) || 0), 0) : 0), 0);
    } else {
      // Other providers not implemented yet in this function
      count = 0;
      total = 0;
      orders = 0;
      items = 0;
    }

    if (!dryRun) {
      const { error: rpcErr } = await svc.rpc("upsert_consumption" as any, {
        _client_id: clientId,
        _location_id: locationId,
        _provider: provider,
        _date: to,
        _total: total,
        _orders: orders,
        _items: items,
        _discounts: discounts,
        _taxes: taxes,
        _meta: { correlation_id, from, to },
      });
      if (rpcErr) throw new Error(rpcErr.message);
    }

    const durationMs = Date.now() - t0;
    const fin = await svc.functions.invoke("pos-sync-logger", {
      body: { action: "success", runId, count, durationMs, meta: { correlation_id } },
    });
    if (fin.error) {
      return new Response(
        JSON.stringify({ error: fin.error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ runId, count }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const durationMs = Date.now() - t0;
    await svc.functions.invoke("pos-sync-logger", {
      body: { action: "error", runId, error: String((err as any)?.message ?? err), durationMs, meta: { correlation_id } },
    });
    return new Response(
      JSON.stringify({ error: "internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

serve(withCORS(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  return handlePosSyncRequest(req);
}, {
  allowlist: buildAllowlist(),
  credentials: false, // orchestration endpoint: sin credenciales
  maxAge: 86400,
  allowHeaders: ["authorization", "content-type", "x-job-token", "x-api-key"]
}));
