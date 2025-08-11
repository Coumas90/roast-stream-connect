
import { supabase } from "@/integrations/supabase/client";
import type { AppPosProvider } from "@/integrations/supabase/pos-types";

type CanSyncParams = {
  clientId?: string | null;
  locationId: string;
  provider: AppPosProvider;
  now?: typeof Date; // default Date; use new now!() to get current time
};

type StartSyncParams = {
  clientId?: string | null;
  locationId: string;
  provider: AppPosProvider;
};

type LogSuccessParams = {
  count: number;
  durationMs: number;
  meta?: Record<string, unknown>;
};

type LogErrorParams = {
  error: string;
  durationMs: number;
};

export type CanSyncResult = { ok: true } | { ok: false; reason: string; waitMs: number };

/**
 * canSync: consulta pos_sync_status y respeta paused_until y next_attempt_at.
 */
export async function canSync(params: CanSyncParams): Promise<CanSyncResult> {
  const { locationId, provider, now = Date } = params;

  const { data, error } = await supabase
    .from("pos_sync_status")
    .select("paused_until,next_attempt_at")
    .match({ location_id: locationId, provider })
    .maybeSingle();

  if (error) {
    // En caso de error de lectura, no bloqueamos el sync (preferimos fail-open).
    console.warn("[sync-logger/canSync] read error:", error);
    return { ok: true };
  }

  const nowTs = new now().getTime();

  const pausedUntil = data?.paused_until ? new Date(data.paused_until).getTime() : null;
  if (pausedUntil && pausedUntil > nowTs) {
    return {
      ok: false,
      reason: "paused_until",
      waitMs: pausedUntil - nowTs,
    };
  }

  const nextAttemptAt = data?.next_attempt_at ? new Date(data.next_attempt_at).getTime() : null;
  if (nextAttemptAt && nextAttemptAt > nowTs) {
    return {
      ok: false,
      reason: "backoff",
      waitMs: nextAttemptAt - nowTs,
    };
  }

  return { ok: true };
}

/**
 * startSync: crea un run con status=running y calcula attempt en el server.
 */
export async function startSync(params: StartSyncParams): Promise<{ runId: string }> {
  const { data, error } = await supabase.functions.invoke("pos-sync-logger", {
    body: { action: "start", ...params },
  });
  if (error) throw error;
  return data as { runId: string };
}

/**
 * logSuccess: cierra el run en success y resetea status (failures=0, limpia errores, etc).
 */
export async function logSuccess(runId: string, params: LogSuccessParams): Promise<{
  failures: number;
  lastRunAt: string;
}> {
  const { data, error } = await supabase.functions.invoke("pos-sync-logger", {
    body: { action: "success", runId, ...params },
  });
  if (error) throw error;
  return data as { failures: number; lastRunAt: string };
}

/**
 * logError: cierra el run en error, incrementa failures, calcula backoff con jitter y autopausa a los 5 fallos.
 */
export async function logError(runId: string, params: LogErrorParams): Promise<{
  failures: number;
  nextAttemptAt: string;
  pausedUntil?: string | null;
}> {
  const { data, error } = await supabase.functions.invoke("pos-sync-logger", {
    body: { action: "error", runId, ...params },
  });
  if (error) throw error;
  return data as { failures: number; nextAttemptAt: string; pausedUntil?: string | null };
}

