/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Types mirrored from app
type AppPosProvider = "fudo" | "maxirest" | "bistrosoft" | "other";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const JOB_TOKEN = Deno.env.get("POS_SYNC_JOB_TOKEN") ?? "";

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
  // X-Job-Token (constant-time compare)
  const tok = req.headers.get("X-Job-Token") ?? req.headers.get("x-job-token") ?? "";
  if (JOB_TOKEN && tok && safeEqual(JOB_TOKEN, tok)) return { ok: true, mode: "job" };

  // Admin JWT path
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const userClient = createClient(SUPABASE_URL, ANON_KEY || "anon", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: auth } },
    });
    // is_tupa_admin() relies on auth.uid()
    const { data, error } = await userClient.rpc("is_tupa_admin" as any);
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Service client (DB writes allowed)
  const svc = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const payload = await req.json().catch(() => ({}));
    const { clientId, locationId, provider, range, dryRun } = payload ?? {};

    // Strict validation
    if (!isUUID(clientId ?? "") || !isUUID(locationId ?? "")) return json({ error: "invalid uuid" }, 400);
    if (!(["fudo", "bistrosoft", "maxirest", "other"] as const).includes(provider)) return json({ error: "invalid provider" }, 400);

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

    // Dual authorization
    const authz = await authorize(req);
    if (!authz.ok) return json({ error: "forbidden" }, 403);

    // Backoff/autopause gate
    const can = await canSync(svc, locationId, provider);
    if (!can.ok) {
      return json({ skipped: true, reason: can.reason, waitMs: can.waitMs }, 200);
    }

    // Start run via logger
    const correlation_id = crypto.randomUUID();
    const t0 = Date.now();

    const startResp = await svc.functions.invoke("pos-sync-logger", {
      body: { action: "start", clientId, locationId, provider },
    });
    if (startResp.error) return json({ error: startResp.error.message }, 500);
    const runId = (startResp.data as any)?.runId as string;

    try {
      // Execute sync. For v1 we simulate a provider fetch and aggregate minimal totals.
      // In a real adapter, fetch sales and compute totals.
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
        body: {
          action: "success",
          runId,
          count,
          durationMs,
          meta: { correlation_id },
        },
      });
      if (fin.error) return json({ error: fin.error.message }, 500);

      return json({ runId, count }, 200);
    } catch (err) {
      const durationMs = Date.now() - t0;
      await svc.functions.invoke("pos-sync-logger", {
        body: { action: "error", runId, error: String((err as any)?.message ?? err), durationMs },
      });
      return json({ error: "internal error" }, 500);
    }
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});
