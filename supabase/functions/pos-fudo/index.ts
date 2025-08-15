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
      const valid = typeof apiKey === "string" && apiKey.trim().length >= 6;
      return cors.jsonResponse(req, valid ? { valid: true } : { valid: false, reason: "API key inválida (mínimo 6 caracteres)" }, { status: valid ? 200 : 400 });
    }

    if (req.method === "POST" && path === "products") {
      const { sinceIso } = await req.json();
      const since = new Date(sinceIso || 0);
      const now = new Date();
      return cors.jsonResponse(req, [
        { externalId: "fudo-101", name: "Espresso", sku: "ESP-01", price: 1000, updatedAt: now.toISOString() },
        { externalId: "fudo-102", name: "Latte", sku: "LAT-01", price: 1500, updatedAt: now.toISOString() },
      ]);
    }

    if (req.method === "POST" && path === "orders") {
      const { sinceIso } = await req.json();
      const since = new Date(sinceIso || 0);
      const now = new Date();
      return cors.jsonResponse(req, [
        { externalId: "ord-f-1", total: 2500, items: [{ sku: "ESP-01", qty: 1 }], updatedAt: now.toISOString() },
        { externalId: "ord-f-2", total: 4000, items: [{ sku: "LAT-01", qty: 2 }], updatedAt: now.toISOString() },
      ]);
    }

    return cors.jsonResponse(req, { error: "Not found" }, { status: 404 });
  } catch (e) {
    console.error("pos-fudo error", e);
    return cors.jsonResponse(req, { error: "Server error" }, { status: 500 });
  }
});
