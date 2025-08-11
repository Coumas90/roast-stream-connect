/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const D = (globalThis as any).Deno;
const SUPABASE_URL: string = D?.env?.get("SUPABASE_URL") ?? "";
const SERVICE_KEY: string = D?.env?.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY: string = D?.env?.get("SUPABASE_ANON_KEY") ?? "";
const JOB_TOKEN: string = D?.env?.get("POS_SYNC_JOB_TOKEN") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(res: unknown, init: number | ResponseInit = 200) {
  const status = typeof init === "number" ? init : init.status ?? 200;
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  return new Response(JSON.stringify(res), { status, headers });
}

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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require JWT - Supabase will enforce verify_jwt=true, but ensure Authorization header is present
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "forbidden" }, 403);

  const payload = await req.json().catch(() => ({} as any));
  const { locationId, provider, date } = payload ?? {};

  if (!isUUID(locationId ?? "")) return json({ error: "invalid locationId" }, 400);
  if (!( ["fudo", "bistrosoft", "maxirest", "other"] as const).includes(provider)) return json({ error: "invalid provider" }, 400);

  const day: string = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : yesterdayUTC();

  // User-scoped client to check permissions
  const userClient = deps?.userClient ?? createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } },
  });

  const { data: canManage, error: permErr } = await (userClient.rpc as any)("user_can_manage_pos", { _location_id: locationId });
  if (permErr || canManage !== true) return json({ error: "forbidden" }, 403);

  // Service client to fetch tenant_id and call pos-sync
  const svc = deps?.svc ?? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: locRow, error: locErr } = await svc
    .from("locations")
    .select("tenant_id")
    .eq("id", locationId)
    .maybeSingle();

  if (locErr || !locRow?.tenant_id) return json({ error: "invalid location" }, 400);

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

    if (error) return json({ error: "internal" }, 500);
    return json(data ?? {}, 200);
  } catch {
    return json({ error: "internal" }, 500);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  return handlePosSyncUiRequest(req);
});
