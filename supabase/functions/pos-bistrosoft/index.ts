import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createCorsHandler } from "../_shared/cors.ts";

const cors = createCorsHandler();

serve(async (req) => {
  if (req.method === "OPTIONS") return cors.handlePreflight(req);

  const url = new URL(req.url);
  const path = url.pathname.split("/").slice(-1)[0];

  try {
    if (req.method === "POST" && path === "validate") {
      const { apiKey } = await req.json();
      const valid = typeof apiKey === "string" && apiKey.trim().startsWith("bs_");
      return cors.jsonResponse(req, valid ? { valid: true } : { valid: false, reason: "API key debe comenzar con 'bs_'" }, { status: valid ? 200 : 400 });
    }

    if (req.method === "POST" && path === "products") {
      const now = new Date();
      return cors.jsonResponse(req, [
        { externalId: "bs-301", name: "Mocha", sku: "MOC-01", price: 2000, updatedAt: now.toISOString() },
      ]);
    }

    if (req.method === "POST" && path === "orders") {
      const now = new Date();
      return cors.jsonResponse(req, [
        { externalId: "ord-bs-1", total: 2000, items: [{ sku: "MOC-01", qty: 1 }], updatedAt: now.toISOString() },
      ]);
    }

    return cors.jsonResponse(req, { error: "Not found" }, { status: 404 });
  } catch (e) {
    console.error("pos-bistrosoft error", e);
    return cors.jsonResponse(req, { error: "Server error" }, { status: 500 });
  }
});
