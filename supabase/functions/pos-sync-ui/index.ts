/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withCORS, requireSecureAuth } from "../_shared/cors.ts";
import { buildAllowlist } from "../_shared/patterns.ts";

const D = (globalThis as any).Deno;
const SUPABASE_URL: string = D?.env?.get("SUPABASE_URL") ?? "";
const SERVICE_KEY: string = D?.env?.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY: string = D?.env?.get("SUPABASE_ANON_KEY") ?? "";
const JOB_TOKEN: string = D?.env?.get("POS_SYNC_JOB_TOKEN") ?? "";

function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
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

export async function handlePosSyncUiRequest(req: Request, deps?: { userClient?: any; svc?: any }) {
  // Enhanced auth check for orchestration endpoint
  const authCheck = requireSecureAuth(req, [JOB_TOKEN]);
  if (!authCheck.ok) {
    return new Response(
      JSON.stringify({ error: authCheck.error || "forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // Additional JWT check for user permissions
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const payload = await req.json().catch(() => ({} as any));
  const { locationId, provider, date } = payload ?? {};

  if (!isUUID(locationId ?? "")) {
    return new Response(
      JSON.stringify({ error: "invalid locationId" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!( ["fudo", "bistrosoft", "maxirest", "other"] as const).includes(provider)) {
    return new Response(
      JSON.stringify({ error: "invalid provider" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const day: string = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : yesterdayUTC();

  // User-scoped client to check permissions
  const userClient = deps?.userClient ?? createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } },
  });

  const { data: canManage, error: permErr } = await (userClient.rpc as any)("user_can_manage_pos", { _location_id: locationId });
  if (permErr || canManage !== true) {
    return new Response(
      JSON.stringify({ error: "forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // Service client to fetch tenant_id and call pos-sync
  const svc = deps?.svc ?? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: locRow, error: locErr } = await svc
    .from("locations")
    .select("tenant_id")
    .eq("id", locationId)
    .maybeSingle();

  if (locErr || !locRow?.tenant_id) {
    return new Response(
      JSON.stringify({ error: "invalid location" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { data, error } = await (svc.functions as any).invoke("pos-sync", {
      body: {
        clientId: locRow.tenant_id,
        locationId,
        provider,
        range: { from: day, to: day },
        dryRun: true,
      },
      headers: { "X-Job-Token": JOB_TOKEN },
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: "internal" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(data ?? {}),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "internal" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

serve(withCORS(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "method_not_allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }
  return handlePosSyncUiRequest(req);
}, {
  allowlist: buildAllowlist(),
  credentials: false, // orchestration endpoint: sin credenciales
  maxAge: 86400,
  allowHeaders: ["authorization", "content-type", "x-job-token", "x-api-key"]
}));