
/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type AppPosProvider = "fudo" | "maxirest" | "bistrosoft" | "other";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function now() {
  return new Date();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Calcula backoff exponencial con jitter ±10%
 * base = 60s * 2^failures, máx 30m (1800s)
 */
function computeBackoffSeconds(failures: number) {
  const base = 60 * Math.pow(2, failures);
  const capped = Math.min(base, 1800);
  const jitterFactor = 0.9 + Math.random() * 0.2; // [0.9, 1.1)
  return Math.round(capped * jitterFactor);
}

async function getStatus(locationId: string, provider: AppPosProvider) {
  const { data, error } = await sb
    .from("pos_sync_status")
    .select("*")
    .match({ location_id: locationId, provider })
    .maybeSingle();

  if (error) throw error;
  return data as any | null;
}

async function upsertStatus(fields: {
  location_id: string;
  provider: AppPosProvider;
  consecutive_failures?: number;
  last_run_at?: string | null;
  last_error?: string | null;
  next_attempt_at?: string | null;
  paused_until?: string | null;
}) {
  const payload = {
    location_id: fields.location_id,
    provider: fields.provider,
    consecutive_failures: fields.consecutive_failures ?? 0,
    last_run_at: fields.last_run_at ?? null,
    last_error: fields.last_error ?? null,
    next_attempt_at: fields.next_attempt_at ?? null,
    paused_until: fields.paused_until ?? null,
  };

  const { error } = await sb
    .from("pos_sync_status")
    .upsert(payload, { onConflict: "location_id,provider" });
  if (error) throw error;
}

async function startRun(params: { clientId?: string | null; locationId: string; provider: AppPosProvider }) {
  const { clientId, locationId, provider } = params;

  // Aseguramos fila de status
  const status = await getStatus(locationId, provider);
  const currentFailures = status?.consecutive_failures ?? 0;
  if (!status) {
    await upsertStatus({ location_id: locationId, provider, consecutive_failures: 0 });
  }

  const attempt = clamp((currentFailures ?? 0) + 1, 1, 1_000_000);

  const { data: run, error: runErr } = await sb
    .from("pos_sync_runs")
    .insert({
      client_id: clientId ?? null,
      location_id: locationId,
      provider,
      status: "running",
      attempt,
      started_at: now().toISOString(),
    })
    .select("id")
    .single();

  if (runErr) throw runErr;

  return { runId: run.id as string, attempt };
}

async function finishSuccess(payload: {
  runId: string;
  count: number;
  durationMs: number;
  meta?: Record<string, unknown>;
}) {
  const { runId, count, durationMs, meta } = payload;

  // Traemos run para conocer par location/provider
  const { data: run, error: getRunErr } = await sb
    .from("pos_sync_runs")
    .select("location_id,provider")
    .eq("id", runId)
    .single();
  if (getRunErr) throw getRunErr;

  const locationId: string = run.location_id;
  const provider: AppPosProvider = run.provider;

  // Cerramos run
  const { error: updRunErr } = await sb
    .from("pos_sync_runs")
    .update({
      status: "success",
      finished_at: now().toISOString(),
      duration_ms: durationMs,
      count,
      error: null,
      meta: meta ?? {},
    })
    .eq("id", runId);
  if (updRunErr) throw updRunErr;

  // Reseteamos status
  const lastRunAt = now().toISOString();
  await upsertStatus({
    location_id: locationId,
    provider,
    consecutive_failures: 0,
    last_error: null,
    last_run_at: lastRunAt,
    next_attempt_at: null,
    paused_until: null,
  });

  return { failures: 0, lastRunAt };
}

async function finishError(payload: { runId: string; error: string; durationMs: number }) {
  const { runId, error: errMsg, durationMs } = payload;

  // Traemos run
  const { data: run, error: getRunErr } = await sb
    .from("pos_sync_runs")
    .select("location_id,provider")
    .eq("id", runId)
    .single();
  if (getRunErr) throw getRunErr;

  const locationId: string = run.location_id;
  const provider: AppPosProvider = run.provider;

  // Estado actual
  const status = await getStatus(locationId, provider);
  const currentFailures = status?.consecutive_failures ?? 0;
  const newFailures = currentFailures + 1;

  // Backoff con jitter
  const seconds = computeBackoffSeconds(newFailures);
  const nextAttemptAt = new Date(now().getTime() + seconds * 1000).toISOString();

  // Autopause a los 5 fallos
  const pausedUntil =
    newFailures >= 5 ? new Date(now().getTime() + 2 * 60 * 60 * 1000).toISOString() : null;

  // Cerramos run en error
  const { error: updRunErr } = await sb
    .from("pos_sync_runs")
    .update({
      status: "error",
      finished_at: now().toISOString(),
      duration_ms: durationMs,
      error: errMsg,
    })
    .eq("id", runId);
  if (updRunErr) throw updRunErr;

  // Actualizamos status
  await upsertStatus({
    location_id: locationId,
    provider,
    consecutive_failures: newFailures,
    last_error: errMsg,
    last_run_at: null,
    next_attempt_at: nextAttemptAt,
    paused_until: pausedUntil,
  });

  return { failures: newFailures, nextAttemptAt, pausedUntil };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body?.action as "start" | "success" | "error";

    if (action === "start") {
      const { clientId, locationId, provider } = body as {
        clientId?: string | null;
        locationId: string;
        provider: AppPosProvider;
      };
      if (!locationId || !provider) {
        return new Response(JSON.stringify({ error: "invalid params" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await startRun({ clientId, locationId, provider });
      return new Response(JSON.stringify(res), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "success") {
      const { runId, count, durationMs, meta } = body as {
        runId: string;
        count: number;
        durationMs: number;
        meta?: Record<string, unknown>;
      };
      if (!runId || typeof count !== "number" || typeof durationMs !== "number") {
        return new Response(JSON.stringify({ error: "invalid params" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await finishSuccess({ runId, count, durationMs, meta });
      return new Response(JSON.stringify(res), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "error") {
      const { runId, error, durationMs } = body as {
        runId: string;
        error: string;
        durationMs: number;
      };
      if (!runId || !error || typeof durationMs !== "number") {
        return new Response(JSON.stringify({ error: "invalid params" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await finishError({ runId, error, durationMs });
      return new Response(JSON.stringify(res), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[pos-sync-logger] error:", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

