import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant";

export default function AppIntegrations() {
  const { tenantId } = useTenant();
  const [posConnected, setPosConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      if (!tenantId) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("pos_integrations")
        .select("connected")
        .eq("tenant_id", tenantId)
        .eq("provider", "odoo")
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.log("[AppIntegrations] error:", error);
      }
      setPosConnected(Boolean(data?.connected));
      setLoading(false);
    };
    fetchStatus();

    const channel = supabase
      .channel("pos_integrations_updates")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pos_integrations" },
        () => fetchStatus()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

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
        <CardContent className="flex items-center gap-3">
          <Switch checked={posConnected} disabled aria-label="Estado POS" />
          <Label>{loading ? "Cargando..." : posConnected ? "Conectado" : "Desconectado"}</Label>
        </CardContent>
      </Card>
    </article>
  );
}
