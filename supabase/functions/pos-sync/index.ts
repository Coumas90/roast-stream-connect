/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptAESGCM, type CipherBundle } from "../_shared/crypto.ts";

// Types mirrored from app
type AppPosProvider = "fudo" | "maxirest" | "bistrosoft" | "other";

// Read env safely (so tests can run under Node by stubbing globalThis.Deno)
const D = (globalThis as any).Deno;
const SUPABASE_URL: string = D?.env?.get("SUPABASE_URL") ?? "";
const SERVICE_KEY: string = D?.env?.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY: string = D?.env?.get("SUPABASE_ANON_KEY") ?? "";
const JOB_TOKEN: string = D?.env?.get("POS_SYNC_JOB_TOKEN") ?? "";
const KMS_HEX: string = D?.env?.get("POS_CRED_KMS_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-job-token",
};

function json(res: unknown, init: number | ResponseInit = 200) {
  const status = typeof init === "number" ? init : init.status ?? 200;
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  return new Response(JSON.stringify(res), { status, headers });
}

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

export async function handlePosSyncRequest(
  req: Request,
  deps?: { svc?: any; kmsHex?: string }
) {
  const svc = deps?.svc ?? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const kmsHex = deps?.kmsHex ?? KMS_HEX;

  const payload = await req.json().catch(() => ({} as any));
  const { clientId, locationId, provider, range, dryRun } = payload ?? {};

  if (!isUUID(clientId ?? "") || !isUUID(locationId ?? "")) return json({ error: "invalid uuid" }, 400);
  if (!( ["fudo", "bistrosoft", "maxirest", "other"] as const).includes(provider)) return json({ error: "invalid provider" }, 400);

  let from: string;
  let to: string;
  if (!range) {
    from = to = yesterdayUTC();
    } else {
    from = range.from ?? yesterdayUTC();
    to = range.to ?? from;
  }
  if (!isYYYYMMDD(from) || !isYYYYMMDD(to)) return json({ error: "invalid range format" }, 400);
  if (toDateUTC(from).getTime() > toDateUTC(to).getTime()) return json({ error: "from>to" }, 400);
  if (diffDaysInclusive(from, to) > 31) return json({ error: "range too large (max 31 days)" }, 400);

  const authz = await authorize(req);
  if (!authz.ok) return json({ error: "forbidden" }, 403);

  if (!kmsHex || !/^[0-9a-fA-F]{64}$/.test(kmsHex)) return json({ error: "kms_misconfigured" }, 500);

  const { data: credRow, error: credErr } = await svc
    .from("pos_provider_credentials")
    .select("ciphertext,status")
    .eq("location_id", locationId)
    .eq("provider", provider)
    .maybeSingle();

  if (credErr) return json({ error: "db_error" }, 500);
  if (!credRow) return json({ skipped: true, reason: "no_credentials" }, 200);
  if (credRow.status === "invalid") return json({ skipped: true, reason: "invalid_credentials" }, 200);

  let credentials: Record<string, unknown>;
  try {
    const bundle = JSON.parse(credRow.ciphertext) as CipherBundle;
    credentials = (await decryptAESGCM(kmsHex, bundle)) as Record<string, unknown>;
  } catch {
    return json({ error: "ciphertext_invalid" }, 500);
  }

  // Pre-validate credentials (lightweight auth)
  const apiKey = typeof credentials["apiKey"] === "string" ? String(credentials["apiKey"]).trim() : "";
  let unauthorized = false;
  if (provider === "bistrosoft") unauthorized = !(apiKey.startsWith("bs_") && apiKey.length >= 4);
  else if (provider === "maxirest") unauthorized = !(/[A-Z0-9]{8,}/.test(apiKey));
  else unauthorized = apiKey.length < 6; // fudo/other minimal check

  if (unauthorized) {
    await svc
      .from("pos_provider_credentials")
      .update({ status: "invalid", last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("location_id", locationId)
      .eq("provider", provider);
    return json({ skipped: true, reason: "invalid_credentials" }, 200);
  }

  // Backoff/autopause gate (only after valid credentials)
  const can = await canSync(svc, locationId, provider);
  if (!can.ok) return json({ skipped: true, reason: can.reason, waitMs: can.waitMs }, 200);

  // Start run via logger (only now do we generate correlation_id)
  const correlation_id = crypto.randomUUID();
  const t0 = Date.now();
  const startResp = await svc.functions.invoke("pos-sync-logger", {
    body: { action: "start", clientId: null, locationId, provider, meta: { correlation_id } },
  });
  if (startResp.error) return json({ error: startResp.error.message }, 500);
  const runId = (startResp.data as any)?.runId as string;

  try {
    // Simulated sync
    let count = 0;
    const total = 0;
    const orders = 0;
    const items = 0;
    const discounts = 0;
    const taxes = 0;

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
    if (fin.error) return json({ error: fin.error.message }, 500);
    return json({ runId, count }, 200);
  } catch (err) {
    const durationMs = Date.now() - t0;
    await svc.functions.invoke("pos-sync-logger", {
      body: { action: "error", runId, error: String((err as any)?.message ?? err), durationMs, meta: { correlation_id } },
    });
    return json({ error: "internal error" }, 500);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return handlePosSyncRequest(req);
});
