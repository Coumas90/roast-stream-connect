import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const allowedProviders = new Set(["fudo", "maxirest", "bistrosoft", "other"]);

// Very simple in-memory rate limiting (best-effort per instance)
const RATE_LIMIT = 30; // requests per window per IP
const WINDOW_MS = 60_000; // 1 minute
const rl = new Map<string, { count: number; resetAt: number }>();

function getIp(req: Request) {
  const xf = req.headers.get("x-forwarded-for");
  if (!xf) return "unknown";
  return xf.split(",")[0].trim();
}

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

function validatePayload(body: any): { ok: boolean; provider?: string; apiKey?: string; error?: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid JSON body" };
  const { provider, apiKey } = body as { provider?: unknown; apiKey?: unknown };
  if (typeof provider !== "string" || !allowedProviders.has(provider)) {
    return { ok: false, error: "Unsupported provider" };
  }
  if (typeof apiKey !== "string" || apiKey.trim().length < 1) {
    return { ok: false, error: "Invalid apiKey" };
  }
  if (apiKey.length > 4096) {
    return { ok: false, error: "Payload too large" };
  }
  return { ok: true, provider, apiKey };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ip = getIp(req);
  const now = Date.now();
  const cur = rl.get(ip);
  if (!cur || now >= cur.resetAt) {
    rl.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else if (cur.count >= RATE_LIMIT) {
    await writeLog({ level: "warn", message: "rate_limited", meta: { ip } });
    return new Response(JSON.stringify({ valid: false, error: "Too many requests" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } else {
    cur.count++;
  }

  try {
    const body = await req.json().catch(() => null);
    const v = validatePayload(body);
    if (!v.ok) {
      await writeLog({ level: "warn", message: "invalid_payload", meta: { ip, error: v.error } });
      return new Response(JSON.stringify({ valid: false, error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    // Stub: only format-based validation
    const valid = true;

    await writeLog({ provider: v.provider, level: "info", message: "validate", meta: { valid } });

    return new Response(JSON.stringify({ valid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("validate-credentials error", error);
    await writeLog({ level: "error", message: "exception", meta: { error: String(error), ip } });
    return new Response(JSON.stringify({ valid: false, error: "Invalid payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
});
