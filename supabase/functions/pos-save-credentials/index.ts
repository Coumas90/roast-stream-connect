import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers (match project convention)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KMS_HEX = Deno.env.get("POS_CRED_KMS_KEY") || ""; // 64 hex chars

const allowedProviders = new Set(["fudo", "bistrosoft", "maxirest", "other"]);
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  if (clean.length % 2 !== 0) throw new Error("invalid hex length");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

async function encryptJsonGCM(keyHex: string, payload: unknown) {
  if (!keyHex || keyHex.length !== 64) throw new Error("KMS key not configured");
  const keyRaw = hexToBytes(keyHex);
  const key = await crypto.subtle.importKey("raw", keyRaw, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const ctFull = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  const tagLen = 16; // bytes
  const tag = ctFull.slice(ctFull.length - tagLen);
  const body = ctFull.slice(0, ctFull.length - tagLen);
  return {
    iv: toB64(iv.buffer),
    tag: toB64(tag.buffer),
    data: toB64(body.buffer),
  };
}

function buildMaskedHints(creds: Record<string, any>) {
  const hints: Record<string, string> = {};
  const pick = (v?: string) => (typeof v === "string" && v.length > 4 ? `…${v.slice(-4)}` : undefined);
  const ak = pick(creds.apiKey);
  if (ak) hints.apiKeyEnd = ak;
  const tk = pick(creds.token);
  if (tk) hints.tokenEnd = tk;
  if (typeof creds.storeId === "string") hints.storeId = creds.storeId;
  if (typeof creds.env === "string") {
    const env = creds.env.toLowerCase();
    if (env === "production" || env === "staging") hints.env = env;
  }
  return hints;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || ""; // verify_jwt=true will enforce valid JWT

    // Parse and validate payload
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    const { locationId, provider, credentials } = body as {
      locationId?: unknown;
      provider?: unknown;
      credentials?: unknown;
    };

    if (typeof locationId !== "string" || !uuidRe.test(locationId)) {
      return new Response(JSON.stringify({ error: "Invalid locationId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
    if (typeof provider !== "string" || !allowedProviders.has(provider)) {
      return new Response(JSON.stringify({ error: "Unsupported provider" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
    if (!credentials || typeof credentials !== "object" || Array.isArray(credentials) || Object.keys(credentials as any).length === 0) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    // Authorization: user must have access to location
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: allowed, error: authErr } = await supabaseAuth.rpc("user_has_location", { _location_id: locationId });
    if (authErr) {
      // Don't leak details
      return new Response(JSON.stringify({ error: "Auth check failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    // Permission: must be owner/manager/admin for the location
    const supabaseSvc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: canManage, error: permErr } = await (supabaseSvc.rpc as any)("user_can_manage_pos", { _location_id: locationId });
    if (permErr) {
      return new Response(JSON.stringify({ error: "permission_check_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
    if (!canManage) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    // Encrypt
    if (!KMS_HEX || KMS_HEX.length !== 64) {
      return new Response(JSON.stringify({ error: "KMS key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
    const enc = await encryptJsonGCM(KMS_HEX, credentials);
    const ciphertext = JSON.stringify({ iv: enc.iv, tag: enc.tag, data: enc.data });

    const masked_hints = buildMaskedHints(credentials as Record<string, any>);

    // Upsert via service role (bypass RLS)
    const { error: upsertErr } = await supabaseSvc
      .from("pos_provider_credentials")
      .upsert(
        [{ location_id: locationId, provider, ciphertext, masked_hints, status: "pending" }],
        { onConflict: "location_id,provider" }
      );

    if (upsertErr) {
      return new Response(JSON.stringify({ error: "Failed to save credentials" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    return new Response(JSON.stringify({ status: "pending", masked_hints }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("pos-save-credentials error", error);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
});
