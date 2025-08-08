import React, { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant";
import { toast } from "@/hooks/use-toast";

export default function AdminIntegrations() {
  const { tenantId } = useTenant();
  const [posConnected, setPosConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
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
    if (error) {
      console.log("[AdminIntegrations] error:", error);
      toast({ title: "Error", description: "No se pudo cargar el estado del POS", variant: "destructive" });
    }
    setPosConnected(Boolean(data?.connected));
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchStatus();
    const channel = supabase
      .channel("pos_integrations_admin_updates")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pos_integrations" },
        () => fetchStatus()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchStatus]);

  const onToggle = async (checked: boolean) => {
    if (!tenantId) return;
    const { error } = await supabase
      .from("pos_integrations")
      .update({ connected: checked })
      .eq("tenant_id", tenantId)
      .eq("provider", "odoo");
    if (error) {
      console.log("[AdminIntegrations] update error:", error);
      toast({ title: "Error", description: "No se pudo actualizar el POS", variant: "destructive" });
    } else {
      toast({ title: "Actualizado", description: checked ? "POS conectado" : "POS desconectado" });
      setPosConnected(checked);
    }
  };

  return (
    <article>
      <Helmet>
        <title>Integraciones | TUPÁ Hub</title>
        <meta name="description" content="Estado de integraciones y POS" />
        <link rel="canonical" href="/admin/integrations" />
      </Helmet>
      <h1 className="sr-only">Integraciones</h1>
      <Card>
        <CardHeader><CardTitle>POS</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-3">
          <Switch checked={posConnected} onCheckedChange={onToggle} disabled={loading} />
          <Label>{loading ? "Cargando..." : posConnected ? "Conectado" : "Desconectado"}</Label>
        </CardContent>
      </Card>
    </article>
  );
}
