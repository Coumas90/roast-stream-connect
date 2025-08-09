import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { posSupabase } from "@/integrations/supabase/pos-client";
import type { AppPosProvider, EffectivePosRow } from "@/integrations/supabase/pos-types";
import { useTenant } from "@/lib/tenant";
import { toast } from "@/hooks/use-toast";

// Hook to read effective POS with realtime updates
export function useEffectivePos() {
  const { tenantId, locationId } = useTenant();
  const [data, setData] = useState<EffectivePosRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false);
      setData(null);
      return;
    }
    setIsLoading(true);
    const { data, error } = await posSupabase.rpc("effective_pos", {
      _tenant_id: tenantId,
      _location_id: locationId ?? null,
    });
    if (error) {
      console.log("[useEffectivePos] effective_pos error:", error);
      setError(error.message || "Error al obtener estado POS");
      setData(null);
    } else {
      const row = Array.isArray(data) ? (data as EffectivePosRow[])[0] : null;
      setData(row ?? null);
      setError(null);
    }
    setIsLoading(false);
  }, [tenantId, locationId]);

  useEffect(() => {
    let active = true;
    fetchStatus();

    // Single channel for both tables
    const channel = posSupabase
      .channel("pos_integrations_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pos_integrations_location" },
        () => {
          if (!active) return;
          if (debounceRef.current) window.clearTimeout(debounceRef.current);
          debounceRef.current = window.setTimeout(() => fetchStatus(), 200);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pos_integrations_tenant" },
        () => {
          if (!active) return;
          if (debounceRef.current) window.clearTimeout(debounceRef.current);
          debounceRef.current = window.setTimeout(() => fetchStatus(), 200);
        }
      )
      .subscribe();

    return () => {
      active = false;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      posSupabase.removeChannel(channel);
    };
  }, [fetchStatus]);

  return useMemo(
    () => ({
      provider: data?.provider ?? null,
      source: data?.source ?? null,
      connected: Boolean(data?.connected),
      isLoading,
      error,
      refetch: fetchStatus,
    }),
    [data, isLoading, error, fetchStatus]
  );
}

export function usePosActions() {
  const { tenantId, locationId } = useTenant();

  const connect = useCallback(
    async (provider: AppPosProvider, apiKey: string) => {
      if (!locationId) return;
      const { error } = await posSupabase.rpc("set_pos_location", {
        _location_id: locationId,
        _provider: provider,
        _connected: true,
        _config: { apiKey },
      } as any);

      if (error) {
        const code = (error as any)?.code || (error as any)?.details || "";
        if (typeof code === "string" && code.includes("23505")) {
          toast({ title: "Ya hay un POS conectado en esta sucursal", description: "Desconecta primero para cambiar." });
        } else {
          toast({ title: "Error al conectar POS", description: (error as any).message || "Intenta nuevamente" });
        }
        throw error;
      }
      toast({ title: "POS conectado", description: "La sucursal quedó vinculada correctamente." });
    },
    [locationId]
  );

  const disconnect = useCallback(
    async (provider: AppPosProvider) => {
      if (!locationId) return;
      const { error } = await posSupabase.rpc("set_pos_location", {
        _location_id: locationId,
        _provider: provider,
        _connected: false,
        _config: {},
      } as any);

      if (error) {
        toast({ title: "Error al desconectar POS", description: (error as any).message || "Intenta nuevamente" });
        throw error;
      }
      toast({ title: "POS desconectado", description: "Se desactivó para esta sucursal." });
    },
    [locationId]
  );

  const changeProvider = useCallback(
    async (next: AppPosProvider, apiKey?: string) => {
      // For change we connect with next provider (connected: true)
      return connect(next, apiKey ?? "");
    },
    [connect]
  );

  return { connect, disconnect, changeProvider, tenantId, locationId };
}
