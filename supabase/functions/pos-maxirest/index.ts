import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(res: unknown, init: number | ResponseInit = 200) {
  const status = typeof init === "number" ? init : init.status ?? 200;
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  return new Response(JSON.stringify(res), { status, headers });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.split("/").slice(-1)[0];

  try {
    if (req.method === "POST" && path === "validate") {
      const { apiKey } = await req.json();
      const valid = typeof apiKey === "string" && /[A-Z0-9]{8,}/.test(apiKey.trim());
      return json(valid ? { valid: true } : { valid: false, reason: "API key inválida (alfanumérica, 8+)" }, valid ? 200 : 400);
    }

    if (req.method === "POST" && path === "products") {
      const now = new Date();
      return json([
        { externalId: "mx-201", name: "Capuccino", sku: "CAP-01", price: 1800, updatedAt: now.toISOString() },
      ]);
    }

    if (req.method === "POST" && path === "orders") {
      const now = new Date();
      return json([
        { externalId: "ord-mx-1", total: 3200, items: [{ sku: "CAP-01", qty: 2 }], updatedAt: now.toISOString() },
      ]);
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error("pos-maxirest error", e);
    return json({ error: "Server error" }, 500);
  }
});
