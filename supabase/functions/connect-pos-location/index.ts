import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function writeLog(entry: { location_id?: string | null; provider?: string | null; level: "info" | "error" | "warn" | "debug"; message: string; meta?: Record<string, unknown> }) {
  try {
    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } } });
    await client.from("pos_logs").insert({
      ts: new Date().toISOString(),
      location_id: entry.location_id ?? null,
      provider: (entry.provider as any) ?? null,
      scope: "connect-pos",
      level: entry.level,
      message: entry.message,
      meta: entry.meta ?? {},
    });
  } catch (e) {
    console.warn("connect-pos-location: failed to write log", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { locationId, provider, apiKey } = await req.json();
    const allowed = ["fudo", "maxirest", "bistrosoft", "other"];
    if (!allowed.includes(provider)) {
      return new Response(JSON.stringify({ error: "Proveedor no soportado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!locationId || (typeof apiKey !== "string") || apiKey.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Parámetros inválidos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate against provider stub function
    const fn = provider === "other" ? "pos-bistrosoft" : `pos-${provider}`; // map 'other' to any stub for now
    const validateUrl = `${SUPABASE_URL}/functions/v1/${fn}/validate`;

    const provRes = await fetch(validateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    const provJson = await provRes.json();
    if (!provRes.ok || provJson?.valid !== true) {
      const reason = provJson?.reason || "API key inválida";
      return new Response(JSON.stringify({ error: reason }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
});

await writeLog({ location_id: locationId, provider, level: "info", message: "connect attempt", meta: {} });

const { error } = await supabase.rpc("connect_pos_location", {
  _location_id: locationId,
  _provider: provider,
  _api_key: apiKey,
});

if (error) {
  const msg = error.message || "Error al conectar POS";
  const status = /forbidden/i.test(msg) ? 403 : /authentication required/i.test(msg) ? 401 : 400;
  await writeLog({ location_id: locationId, provider, level: "error", message: "connect failed", meta: { msg } });
  return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

await writeLog({ location_id: locationId, provider, level: "info", message: "connect ok" });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("connect-pos-location error", error);
    await writeLog({ level: "error", message: "exception", meta: { error: String(error) } });
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
