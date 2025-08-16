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
      const valid = typeof apiKey === "string" && /[A-Z0-9]{8,}/.test(apiKey.trim());
      return new Response(
        JSON.stringify(valid ? { valid: true } : { valid: false, reason: "API key inválida (alfanumérica, 8+)" }),
        { 
          status: valid ? 200 : 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (req.method === "POST" && path === "products") {
      const now = new Date();
      return new Response(
        JSON.stringify([
          { externalId: "mx-201", name: "Capuccino", sku: "CAP-01", price: 1800, updatedAt: now.toISOString() },
        ]),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST" && path === "orders") {
      const now = new Date();
      return new Response(
        JSON.stringify([
          { externalId: "ord-mx-1", total: 3200, items: [{ sku: "CAP-01", qty: 2 }], updatedAt: now.toISOString() },
        ]),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pos-maxirest error", e);
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