import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedProviders = new Set(["fudo", "bistrosoft", "maxirest", "other"] as const);

type Provider = "fudo" | "bistrosoft" | "maxirest" | "other";

type CipherBundle = { iv: string; tag: string; data: string };

const hexToBytes = (hex: string) => new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function decryptJsonGCM(keyHex: string, bundle: CipherBundle): Promise<unknown> {
  const keyRaw = hexToBytes(keyHex);
  const cryptoKey = await crypto.subtle.importKey("raw", keyRaw, "AES-GCM", false, ["decrypt"]);
  const iv = fromB64(bundle.iv);
  const body = fromB64(bundle.data);
  const tag = fromB64(bundle.tag);
  const ct = new Uint8Array(body.length + tag.length);
  ct.set(body);
  ct.set(tag, body.length);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ct);
  const json = new TextDecoder().decode(pt);
  return JSON.parse(json);
}

async function verifyWithProvider(provider: Provider, creds: Record<string, unknown>): Promise<boolean> {
  // Stub verifier: never log or expose secrets. Replace with real API pings per provider when available.
  const apiKey = typeof creds.apiKey === "string" ? (creds.apiKey as string) : "";
  const token = typeof creds.token === "string" ? (creds.token as string) : "";
  const anySecret = apiKey || token;
  // Basic heuristic: consider valid if a non-trivial secret exists
  return anySecret.length >= 8;
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

serve(async (req) => {
  try {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return jsonResponse(405, { error: "method_not_allowed" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const kmsKeyHex = Deno.env.get("POS_CRED_KMS_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse(500, { error: "server_misconfigured" });
    }

    if (!kmsKeyHex || !/^[0-9a-fA-F]{64}$/.test(kmsKeyHex)) {
      return jsonResponse(500, { error: "missing_or_invalid_kms_key" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseSvc = createClient(supabaseUrl, serviceRoleKey);

    // Parse and validate body
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse(400, { error: "invalid_json" });
    }

    const { locationId, provider } = payload ?? {};

    if (typeof locationId !== "string" || !uuidRe.test(locationId)) {
      return jsonResponse(400, { error: "invalid_locationId" });
    }
    if (typeof provider !== "string" || !allowedProviders.has(provider)) {
      return jsonResponse(400, { error: "invalid_provider" });
    }

    // AuthZ: user must have access to location
    const { data: hasAccess, error: accessErr } = await (supabaseAuth.rpc as any)("user_has_location", {
      _location_id: locationId,
    });

    if (accessErr) {
      // Do not expose details
      return jsonResponse(403, { error: "forbidden" });
    }
    if (!hasAccess) {
      return jsonResponse(403, { error: "forbidden" });
    }

    // Fetch encrypted credentials (service client)
    const { data: row, error: selErr } = await supabaseSvc
      .from("pos_provider_credentials")
      .select("ciphertext")
      .eq("location_id", locationId)
      .eq("provider", provider)
      .maybeSingle();

    if (selErr) {
      return jsonResponse(500, { error: "db_error" });
    }
    if (!row) {
      return jsonResponse(400, { error: "credentials_not_found" });
    }

    let creds: Record<string, unknown>;
    try {
      const bundle = JSON.parse(row.ciphertext) as CipherBundle;
      creds = (await decryptJsonGCM(kmsKeyHex, bundle)) as Record<string, unknown>;
    } catch {
      return jsonResponse(500, { error: "decrypt_error" });
    }

    // Verify against provider (no secrets in logs)
    let ok = false;
    try {
      ok = await verifyWithProvider(provider as Provider, creds);
    } catch {
      ok = false;
    }

    const newStatus = ok ? "connected" : "invalid";

    const { error: updErr } = await supabaseSvc
      .from("pos_provider_credentials")
      .update({ status: newStatus, last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("location_id", locationId)
      .eq("provider", provider);

    if (updErr) {
      return jsonResponse(500, { error: "db_update_error" });
    }

    return jsonResponse(200, { status: newStatus });
  } catch {
    // Generic error path; never include sensitive data
    return jsonResponse(500, { error: "internal_error" });
  }
});
