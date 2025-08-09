import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS for web/manual invocation; cron doesn't need it but it's harmless
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Simple jittered backoff in ms
const backoff = (attempt: number) => 500 * Math.pow(2, attempt) + Math.floor(Math.random() * 100);

async function writeLog(client: ReturnType<typeof createClient>, entry: {
  tenant_id?: string | null;
  location_id?: string | null;
  provider?: string | null;
  scope: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await client.from("pos_logs").insert({
      ts: new Date().toISOString(),
      tenant_id: entry.tenant_id ?? null,
      location_id: entry.location_id ?? null,
      provider: (entry.provider as any) ?? null,
      scope: entry.scope,
      level: entry.level,
      message: entry.message,
      meta: entry.meta ?? {},
    });
  } catch (e) {
    console.warn("pos-sync: failed to write log", e);
  }
}

type Kind = "products" | "orders";

type RunInput = {
  location_id?: string;
  provider?: "fudo" | "maxirest" | "bistrosoft" | "other";
  kinds?: Kind[]; // default: both
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
  });

  try {
    const payload = (await req.json().catch(() => ({}))) as RunInput | undefined;
    const kinds: Kind[] = payload?.kinds && payload.kinds.length ? payload.kinds : ["products", "orders"];

    // 1) Build target list: either explicit or all connected location/provider pairs
    let targets: { location_id: string; provider: string }[] = [];

    if (payload?.location_id && payload?.provider) {
      targets = [{ location_id: payload.location_id, provider: payload.provider }];
    } else {
      // Connected at location level
      const { data: conns, error: errConns } = await supabase
        .from("pos_integrations_location")
        .select("location_id, provider, connected")
        .eq("connected", true);
      if (errConns) throw errConns;
      targets = (conns ?? []).map((c) => ({ location_id: c.location_id as string, provider: c.provider as string }));
    }

    const results: any[] = [];

    for (const t of targets) {
      for (const kind of kinds) {
        // Wrap with retries
        let attempt = 0;
        let ok = false;
        let errorMsg: string | null = null;
        let items = 0;
        let runId: string | null = null;
        const started_at = new Date().toISOString();

        // Determine last success
        const { data: lastRunData, error: lastRunErr } = await supabase
          .from("pos_sync_runs")
          .select("finished_at")
          .eq("location_id", t.location_id)
          .eq("provider", t.provider)
          .eq("ok", true)
          .eq("kind", kind)
          .order("finished_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastRunErr) throw lastRunErr;
const since = lastRunData?.finished_at ? new Date(lastRunData.finished_at) : null;

// Log start
await writeLog(supabase, {
  location_id: t.location_id,
  provider: t.provider,
  scope: "pos-sync",
  level: "info",
  message: `sync ${kind} start`,
  meta: { since: since?.toISOString() ?? null }
});

// Create run row
        {
          const { data: ins, error: insErr } = await supabase
            .from("pos_sync_runs")
            .insert({
              location_id: t.location_id,
              provider: t.provider,
              kind,
              started_at,
              ok: false,
              items: 0,
            })
            .select("id")
            .single();
          if (insErr) throw insErr;
          runId = ins?.id ?? null;
        }

        while (attempt < 3 && !ok) {
          try {
            // MOCK FETCH: generate a small deterministic sample based on time window
            if (kind === "products") {
              const baseSku = t.provider.slice(0, 2).toUpperCase();
              const sample = [1, 2, 3].map((i) => {
                const ext = `${baseSku}-${i}`;
                const name = `Producto ${i} (${t.provider})`;
                const price = 1000 + i * 100;
                const updated_at = new Date().toISOString();
                return { external_id: ext, name, sku: `${baseSku}${i}`, price, updated_at };
              });

              // Idempotent upsert
              const rows = sample.map((p) => ({
                tenant_id: null, // can be filled later if needed; keeping null-safe by not using FK
                location_id: t.location_id,
                provider: t.provider,
                external_id: p.external_id,
                name: p.name,
                sku: p.sku,
                price: p.price,
                updated_at: p.updated_at,
              }));

              const { error: upErr } = await supabase
                .from("pos_products")
                .upsert(rows as any, { onConflict: "location_id,provider,external_id" });
              if (upErr) throw upErr;
              items = rows.length;
            } else {
              // orders
              const now = Date.now();
              const orders = [1, 2].map((i) => {
                const ext = `${t.provider}-ORD-${Math.floor(now / (1000 * 60))}-${i}`; // bucket/minute
                return {
                  external_id: ext,
                  total: 2500 + i * 300,
                  status: "paid",
                  occurred_at: new Date(now - i * 5 * 60 * 1000).toISOString(),
                };
              });

              const rows = orders.map((o) => ({
                tenant_id: null,
                location_id: t.location_id,
                provider: t.provider,
                external_id: o.external_id,
                total: o.total,
                status: o.status,
                occurred_at: o.occurred_at,
                updated_at: new Date().toISOString(),
              }));

              const { error: upErr } = await supabase
                .from("pos_orders")
                .upsert(rows as any, { onConflict: "location_id,provider,external_id" });
              if (upErr) throw upErr;
              items = rows.length;
            }

            ok = true;
          } catch (e) {
            errorMsg = (e as Error)?.message ?? String(e);
            await new Promise((r) => setTimeout(r, backoff(attempt)));
            attempt += 1;
          }
        }

// Finish run
if (runId) {
  const { error: finErr } = await supabase
    .from("pos_sync_runs")
    .update({
      finished_at: new Date().toISOString(),
      ok,
      error: ok ? null : errorMsg,
      items,
    })
    .eq("id", runId);
  if (finErr) throw finErr;
}

await writeLog(supabase, {
  location_id: t.location_id,
  provider: t.provider,
  scope: "pos-sync",
  level: ok ? "info" : "error",
  message: `sync ${kind} ${ok ? "ok" : "failed"}`,
  meta: { items, attempts: attempt, error: errorMsg }
});

        results.push({ ...t, kind, ok, items, attempts: attempt, error: errorMsg });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
console.error("pos-sync error", error);
await writeLog(supabase, { scope: "pos-sync", level: "error", message: "exception", meta: { error: String(error) } });
return new Response(JSON.stringify({ ok: false, error: (error as Error)?.message ?? String(error) }), {
  status: 500,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
  }
});