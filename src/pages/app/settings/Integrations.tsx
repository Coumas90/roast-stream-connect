import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant";
import type { PosSupabaseClient, AppPosProvider, EffectivePosRow } from "@/integrations/supabase/pos-types";

export default function AppIntegrations() {
  const { tenantId, locationId } = useTenant();
  const [posConnected, setPosConnected] = useState<boolean>(false);
  const [provider, setProvider] = useState<AppPosProvider | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const sb = supabase as PosSupabaseClient;

  useEffect(() => {
    let active = true;

    const fetchStatus = async () => {
      if (!tenantId || !locationId) {
        setLoading(false);
        return;
      }
      // POS efectivo para esta sucursal (override de location prioriza sobre tenant)
      const { data, error } = await sb.rpc("effective_pos", {
        _tenant_id: tenantId,
        _location_id: locationId,
      });

      if (!active) return;

      if (error) {
        console.log("[AppIntegrations] effective_pos error:", error);
      }

      const row = Array.isArray(data) ? (data as EffectivePosRow[])[0] : null;
      setPosConnected(Boolean(row?.connected));
      setProvider((row?.provider as AppPosProvider) ?? null);
      setSource(row?.source ?? null);
      setLoading(false);
    };

    fetchStatus();

    const channel = sb
      .channel("pos_integrations_updates")
      // Cambios a nivel tenant
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pos_integrations_tenant" },
        () => fetchStatus()
      )
      // Cambios a nivel location
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pos_integrations_location" },
        () => fetchStatus()
      )
      .subscribe();

    return () => {
      active = false;
      sb.removeChannel(channel);
    };
  }, [tenantId, locationId]);

  return (
    <article>
      <Helmet>
        <title>Integraciones | TUPÁ Hub</title>
        <meta name="description" content="Integraciones del portal cliente" />
        <link rel="canonical" href="/app/settings/integrations" />
      </Helmet>
      <h1 className="sr-only">Integraciones</h1>
      <Card>
        <CardHeader><CardTitle>POS</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <Switch checked={posConnected} disabled aria-label="Estado POS" />
            <Label>{loading ? "Cargando..." : posConnected ? "Conectado" : "Desconectado"}</Label>
          </div>
          <div className="text-sm text-muted-foreground">
            {loading ? null : (
              <>
                <span className="mr-4">
                  Proveedor: {provider ? ({ fudo: "Fudo", maxirest: "Maxirest", bistrosoft: "Bistrosoft", other: "ERP/Otro" } as Record<AppPosProvider, string>)[provider] : "—"}
                </span>
                <span>Origen: {source ? (source === "location" ? "Sucursal" : "Tenant") : "—"}</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </article>
  );
}
