import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function writeLog(entry: { provider?: string | null; level: "info" | "error" | "warn" | "debug"; message: string; meta?: Record<string, unknown> }) {
  try {
    const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { global: { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` } } });
    await client.from("pos_logs").insert({
      ts: new Date().toISOString(),
      provider: (entry.provider as any) ?? null,
      scope: "validate-credentials",
      level: entry.level,
      message: entry.message,
      meta: entry.meta ?? {},
    });
  } catch (e) {
    console.warn("validate-credentials: failed to write log", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider, apiKey } = await req.json();

    // Stub temporal: validar formato básico y devolver válido
    const valid = typeof apiKey === "string" && apiKey.trim().length > 0 && typeof provider === "string";

    await writeLog({ provider, level: "info", message: "validate", meta: { valid } });

    return new Response(JSON.stringify({ valid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("validate-credentials error", error);
    await writeLog({ level: "error", message: "exception", meta: { error: String(error) } });
    return new Response(JSON.stringify({ valid: false, error: "Invalid payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
