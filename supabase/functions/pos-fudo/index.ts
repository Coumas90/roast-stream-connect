import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withCORS } from "../_shared/cors.ts";
import { buildAllowlist } from "../_shared/patterns.ts";

serve(withCORS(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.split("/").slice(-1)[0];

  try {
    if (req.method === "POST" && path === "validate") {
      const { apiKey } = await req.json();
      const valid = typeof apiKey === "string" && apiKey.trim().length >= 6;
      return new Response(
        JSON.stringify(valid ? { valid: true } : { valid: false, reason: "API key inválida (mínimo 6 caracteres)" }),
        { 
          status: valid ? 200 : 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (req.method === "POST" && path === "products") {
      const { sinceIso } = await req.json();
      const since = new Date(sinceIso || 0);
      const now = new Date();
      return new Response(
        JSON.stringify([
          { externalId: "fudo-101", name: "Espresso", sku: "ESP-01", price: 1000, updatedAt: now.toISOString() },
          { externalId: "fudo-102", name: "Latte", sku: "LAT-01", price: 1500, updatedAt: now.toISOString() },
        ]),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST" && path === "orders") {
      const { sinceIso } = await req.json();
      const since = new Date(sinceIso || 0);
      const now = new Date();
      return new Response(
        JSON.stringify([
          { externalId: "ord-f-1", total: 2500, items: [{ sku: "ESP-01", qty: 1 }], updatedAt: now.toISOString() },
          { externalId: "ord-f-2", total: 4000, items: [{ sku: "LAT-01", qty: 2 }], updatedAt: now.toISOString() },
        ]),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pos-fudo error", e);
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}, {
  allowlist: buildAllowlist(),
  credentials: true,
  maxAge: 86400,
  allowHeaders: ["authorization", "content-type", "x-request-id"]
}));