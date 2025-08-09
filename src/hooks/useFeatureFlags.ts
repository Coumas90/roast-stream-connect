
import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useTenant } from "@/lib/tenant";

export type FeatureFlags = Pick<
  Tables<"entitlements">,
  | "loyalty_enabled"
  | "mystery_enabled"
  | "qa_franchise_enabled"
  | "barista_tool_enabled"
  | "barista_pool_enabled"
  | "academy_enabled"
  | "auto_order_enabled"
  | "pos_connected"
  | "raffles_enabled"
>;

export type FeatureKey = keyof Omit<FeatureFlags, never>;

const DEFAULT_FLAGS: FeatureFlags = {
  loyalty_enabled: false,
  mystery_enabled: false,
  qa_franchise_enabled: false,
  barista_tool_enabled: false,
  barista_pool_enabled: false,
  academy_enabled: false,
  auto_order_enabled: false,
  pos_connected: false,
  raffles_enabled: false,
};

export function useFeatureFlags() {
  const { tenantId, locationId } = useTenant();

  // Memoized cache per tenant/location to avoid flicker when switching
  const lastByKey = useRef<Map<string, { flags: FeatureFlags; tenantPos: boolean; posEffective: boolean }>>(new Map());
  const key = `${tenantId ?? "_"}:${locationId ?? "_"}`;

  const enabled = Boolean(tenantId && locationId);

  const query = useQuery({
    queryKey: ["featureFlags", tenantId, locationId],
    enabled,
    staleTime: 45_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    networkMode: "online",
    placeholderData: () => lastByKey.current.get(key) ?? { flags: DEFAULT_FLAGS, tenantPos: false, posEffective: false },
    queryFn: async () => {
      if (!tenantId || !locationId) return { flags: DEFAULT_FLAGS, tenantPos: false, posEffective: false };

      const [entitlementsRes, effTenantRes, effLocationRes] = await Promise.all([
        supabase
          .from("entitlements")
          .select(
            "loyalty_enabled,mystery_enabled,qa_franchise_enabled,barista_tool_enabled,barista_pool_enabled,academy_enabled,auto_order_enabled,pos_connected,raffles_enabled"
          )
          .eq("tenant_id", tenantId)
          .eq("location_id", locationId)
          .limit(1)
          .maybeSingle(),
        // POS efectivo a nivel tenant (sin override de sucursal)
        (supabase as import("@/integrations/supabase/pos-types").PosSupabaseClient).rpc("effective_pos", { _tenant_id: tenantId, _location_id: null }),
        // POS efectivo para la sucursal actual (considera overrides)
        (supabase as import("@/integrations/supabase/pos-types").PosSupabaseClient).rpc("effective_pos", { _tenant_id: tenantId, _location_id: locationId }),
      ]);

      const flags = (entitlementsRes.data as FeatureFlags | null) ?? DEFAULT_FLAGS;

      const effTenant = Array.isArray(effTenantRes.data) ? effTenantRes.data[0] : null;
      const effLoc = Array.isArray(effLocationRes.data) ? effLocationRes.data[0] : null;

      const tenantPos = Boolean(effTenant?.connected);
      // Habilitación efectiva: POS conectado (tenant o override de location) + flag por sucursal
      const posEffective = Boolean((effLoc?.connected || effTenant?.connected) && flags.pos_connected);

      const result = { flags, tenantPos, posEffective };
      lastByKey.current.set(key, result);

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.info("[flags]", { tenantId, locationId, flags: result });
      }

      return result;
    },
  });

  // Single realtime channel with debounced refetch
  const debounceRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // Cleanup previous channel to avoid duplicates
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (!tenantId) return;

    const ch = supabase.channel(`feature-flags-${tenantId}`);

    ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "entitlements" },
      (payload) => {
        const row: any = payload.new ?? payload.old;
        if (!row) return;
        if (row.tenant_id !== tenantId) return;
        if (locationId && row.location_id !== locationId) return;
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => query.refetch(), 200);
      }
    );

    // Realtime en POS tenant-scope
    ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "pos_integrations_tenant" },
      (payload) => {
        const row = (payload.new ?? payload.old) as { tenant_id?: string } | null;
        if (!row) return;
        if (row.tenant_id && row.tenant_id !== tenantId) return;
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => query.refetch(), 200);
      }
    );

    // Realtime en POS location-scope
    ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "pos_integrations_location" },
      (payload) => {
        const row = (payload.new ?? payload.old) as { location_id?: string } | null;
        if (!row) return;
        if (locationId && row.location_id && row.location_id !== locationId) return;
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => query.refetch(), 200);
      }
    );

    ch.subscribe();
    channelRef.current = ch;

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tenantId, locationId, query.refetch]);

  const value = useMemo(() => ({
    isLoading: enabled ? query.isLoading : false,
    error: query.error,
    flags: query.data?.flags ?? DEFAULT_FLAGS,
    tenantPos: query.data?.tenantPos ?? false,
    posEffective: query.data?.posEffective ?? false,
    locationPos: query.data?.flags?.pos_connected ?? false,
    refetch: query.refetch,
  }), [query.isLoading, enabled, query.error, query.data, query.refetch]);

  return value;
}
