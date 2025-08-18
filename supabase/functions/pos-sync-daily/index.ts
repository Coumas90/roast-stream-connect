/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withCORS } from "../_shared/cors.ts";
import { buildAllowlist } from "../_shared/patterns.ts";

// Env access (so tests can stub globalThis.Deno)
const D = (globalThis as any).Deno;
const SUPABASE_URL: string = D?.env?.get("SUPABASE_URL") ?? "";
const SERVICE_KEY: string = D?.env?.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const JOB_TOKEN: string = D?.env?.get("POS_SYNC_JOB_TOKEN") ?? "";


function json(res: unknown, init: number | ResponseInit = 200) {
  const status = typeof init === "number" ? init : init.status ?? 200;
  const headers = { "Content-Type": "application/json" };
  return new Response(JSON.stringify(res), { status, headers });
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
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

async function listConnectedPairs(svc: any): Promise<Array<{ clientId: string; locationId: string; provider: string }>> {
  // 1) Get connected credentials
  const { data: creds, error: credErr } = await svc
    .from("pos_provider_credentials")
    .select("location_id, provider")
    .eq("status", "connected");
  if (credErr) throw new Error("db_error");
  if (!creds || creds.length === 0) return [];

  const locIds = Array.from(new Set(creds.map((c: any) => c.location_id).filter(Boolean)));
  if (locIds.length === 0) return [];

  // 2) Fetch locations tenant ids (service client bypasses RLS)
  const { data: locs, error: locErr } = await svc
    .from("locations")
    .select("id, tenant_id")
    .in("id", locIds);
  if (locErr) throw new Error("db_error");
  const tenantByLoc = new Map<string, string>(locs?.map((l: any) => [l.id, l.tenant_id]) ?? []);

  return creds
    .map((c: any) => ({
      clientId: String(tenantByLoc.get(c.location_id) ?? ""),
      locationId: c.location_id as string,
      provider: c.provider as string,
    }))
    .filter((x) => x.clientId && x.locationId && x.provider);
}

async function runWithLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        results[idx] = await worker(items[idx]);
      } catch (e) {
        // store error result as any
        (results as any)[idx] = e;
      }
    }
  });
  await Promise.all(runners);
  return results;
}

async function sendAlerts(summary: { total: number; ok: number; skipped: number; backoff: number; invalid: number; errors: number }, day: string) {
  const MIN_ERRORS = Number(D?.env?.get("POS_ALERT_MIN_ERRORS") ?? "1");
  const MIN_INVALID = Number(D?.env?.get("POS_ALERT_MIN_INVALID") ?? "1");
  const MIN_BACKOFF = Number(D?.env?.get("POS_ALERT_MIN_BACKOFF") ?? "10");
  const ON_ERRORS = (D?.env?.get("POS_ALERT_NOTIFY_ON_ERRORS") ?? "true").toLowerCase() === "true";
  const ON_INVALID = (D?.env?.get("POS_ALERT_NOTIFY_ON_INVALID") ?? "true").toLowerCase() === "true";
  const ON_BACKOFF = (D?.env?.get("POS_ALERT_NOTIFY_ON_BACKOFF") ?? "true").toLowerCase() === "true";
  const FORCE = (D?.env?.get("POS_ALERT_FORCE") ?? "").toLowerCase() === "true";

  const { errors, invalid, backoff, total, ok, skipped } = summary;
  const trigger = FORCE || ((ON_ERRORS && errors >= MIN_ERRORS) || (ON_INVALID && invalid >= MIN_INVALID) || (ON_BACKOFF && backoff >= MIN_BACKOFF));
  if (!trigger) return;

  const RESEND_API_KEY = D?.env?.get("RESEND_API_KEY") ?? "";
  const RESEND_FROM = D?.env?.get("RESEND_FROM") ?? "";
  const ALERT_EMAILS = D?.env?.get("ALERT_EMAILS") ?? "";
  const SLACK_WEBHOOK_URL = D?.env?.get("SLACK_WEBHOOK_URL") ?? "";

  const subject = `[POS][ALERTA] errors=${errors} invalid=${invalid} backoff=${backoff} — ${day} UTC`;
  const bodyText = [`POS Sync Diario — Resumen (UTC)`, `Fecha: ${day}`, `Total: ${total} · OK: ${ok} · Skipped: ${skipped}`, `Backoff: ${backoff} · Invalid: ${invalid} · Errors: ${errors}`, ``, `Nota: No se incluyen IDs ni credenciales.`].join("\n");

  // Send email (optional)
  try {
    const toList = ALERT_EMAILS.split(",").map((s) => s.trim()).filter(Boolean);
    if (RESEND_API_KEY && RESEND_FROM && toList.length > 0) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: RESEND_FROM, to: toList, subject, text: bodyText }),
      });
    }
  } catch (e) {
    console.warn("alert_failed", "email");
  }

  // Send Slack (optional)
  try {
    if (SLACK_WEBHOOK_URL) {
      await fetch(SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `POS Sync Diario — ${day} UTC\n${bodyText}` }),
      });
    }
  } catch (e) {
    console.warn("alert_failed", "slack");
  }
}

export async function handlePosSyncDaily(req: Request) {

  // Auth via X-Job-Token
  const tok = req.headers.get("X-Job-Token") ?? req.headers.get("x-job-token") ?? "";
  if (!JOB_TOKEN || !tok || !safeEqual(JOB_TOKEN, tok)) return json({ error: "forbidden" }, 403);

  const svc = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Determine yesterday range
  const day = yesterdayUTC();
  const range = { from: day, to: day };

  try {
    const pairs = await listConnectedPairs(svc);
    const total = pairs.length;

    let ok = 0;
    let skipped = 0;
    let backoff = 0;
    let invalid = 0;
    let errors = 0;

    // Worker to invoke pos-sync per pair
    const worker = async (p: { clientId: string; locationId: string; provider: string }) => {
      const correlation_id = crypto.randomUUID();
      const { data, error } = await (svc.functions as any).invoke("pos-sync", {
        body: {
          clientId: p.clientId,
          locationId: p.locationId,
          provider: p.provider,
          range,
          dryRun: false,
          correlationId: correlation_id, // may be ignored by callee; used for tracing only
        },
        headers: { "X-Job-Token": JOB_TOKEN },
      });

      if (error) {
        errors++;
        return { correlation_id, status: "error" as const };
      }

      const res = data as any;
      if (res?.skipped) {
        if (res.reason === "backoff") backoff++;
        else if (res.reason === "invalid_credentials") invalid++;
        else skipped++;
        return { correlation_id, status: "skipped" as const, reason: res.reason };
      }

      if (res?.runId) {
        ok++;
        return { correlation_id, status: "ok" as const, runId: res.runId };
      }

      // Unexpected shape
      errors++;
      return { correlation_id, status: "error" as const };
    };

    // Limit concurrency to 5
    await runWithLimit(pairs, 5, worker);

    const summary = { total, ok, skipped, backoff, invalid, errors };
    try {
      await sendAlerts(summary, day);
    } catch {}

    return json({ summary }, 200);
  } catch {
    return json({ error: "internal" }, 500);
  }
}

serve(withCORS(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  return handlePosSyncDaily(req);
}, {
  allowlist: buildAllowlist(),
  credentials: false,
  maxAge: 86400,
  allowHeaders: ["authorization", "content-type", "x-job-token"]
}));
