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

// KMS key (do not log this value)
const KMS_HEX = Deno.env.get("POS_CRED_KMS_KEY") || "";

// Encoding helpers
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  if (clean.length % 2 !== 0) throw new Error("invalid hex length");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // btoa is available in Deno runtime
  return btoa(bin);
}

async function encryptSecret(plain: string): Promise<{ iv_b64: string; ct_b64: string }> {
  if (!KMS_HEX || KMS_HEX.length !== 64) throw new Error("kms key not configured");
  const keyBytes = hexToBytes(KMS_HEX);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode(plain);
  const ctBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt);
  const ct = new Uint8Array(ctBuf);
  return { iv_b64: bytesToBase64(iv), ct_b64: bytesToBase64(ct) };
}

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

// Log attempt and KMS presence without exposing values
await writeLog({ location_id: locationId, provider, level: "info", message: "connect attempt", meta: { kms_present: Boolean(KMS_HEX && KMS_HEX.length === 64) } });

if (!KMS_HEX || KMS_HEX.length !== 64) {
  return new Response(JSON.stringify({ error: "KMS key not configured", code: "KMS_KEY_MISSING" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Derive secret reference (must match DB function)
const secretRef = `pos/location/${locationId}/${provider}`;

// Encrypt credential using AES-GCM and save to private storage bucket
const { iv_b64, ct_b64 } = await encryptSecret(apiKey);
const encPayload = {
  v: 1,
  alg: "AES-GCM",
  iv: iv_b64,
  ct: ct_b64,
  created_at: new Date().toISOString(),
};

const svcClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } } });

// Try upload; if bucket missing, create and retry
let uploadErr: any = null;
{
  const blob = new Blob([JSON.stringify(encPayload)], { type: "application/json" });
  const up1 = await svcClient.storage.from("pos-credentials").upload(`${secretRef}.json`, blob, { upsert: true, contentType: "application/json" });
  if (up1.error) {
    uploadErr = up1.error;
    const created = await svcClient.storage.createBucket("pos-credentials", { public: false });
    if (!created.error) {
      const up2 = await svcClient.storage.from("pos-credentials").upload(`${secretRef}.json`, blob, { upsert: true, contentType: "application/json" });
      uploadErr = up2.error || null;
    }
  }
}

if (uploadErr) {
  await writeLog({ location_id: locationId, provider, level: "error", message: "secret upload failed", meta: { reason: String(uploadErr?.message || uploadErr) } });
  return new Response(JSON.stringify({ error: "No se pudo guardar la credencial cifrada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
});

const { error } = await supabase.rpc("connect_pos_location", {
  _location_id: locationId,
  _provider: provider,
  _api_key: apiKey,
});

if (error) {
  // Revert secret upload on failure to connect
  await svcClient.storage.from("pos-credentials").remove([`${secretRef}.json`]);
}


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
