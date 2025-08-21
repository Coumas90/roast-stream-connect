
import React, { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { posSupabase } from "@/integrations/supabase/pos-client";
import { useTenant } from "@/lib/tenant";
import { toast } from "@/hooks/use-toast";
import type { AppPosProvider, EffectivePosRow } from "@/integrations/supabase/pos-types";
import PosStatus from './PosStatus';
import ChaosTestDashboard from '@/components/admin/dashboard/ChaosTestDashboard';

export default function AdminIntegrations() {
  const { tenantId } = useTenant();
  const [posConnected, setPosConnected] = useState<boolean>(false);
  const [provider, setProvider] = useState<AppPosProvider>("other");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const sb = posSupabase;
  const fetchStatus = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    // Estado efectivo a nivel tenant (sin override de sucursal)
    const sb = posSupabase;
    const { data, error } = await sb.rpc("effective_pos", { _tenant_id: tenantId, _location_id: null });

    if (error) {
      console.log("[AdminIntegrations] effective_pos error:", error);
      toast({ title: "Error", description: "No se pudo cargar el estado del POS", variant: "destructive" });
    }

    const row = Array.isArray(data) ? (data as EffectivePosRow[])[0] : null;
    setPosConnected(Boolean(row?.connected));
    setProvider((row?.provider as AppPosProvider) ?? "other");
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchStatus();

    const channel = sb
      .channel("pos_integrations_admin_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pos_integrations_tenant" },
        () => fetchStatus()
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [fetchStatus]);

  const onToggle = async (checked: boolean) => {
    if (!tenantId) return;
    const prev = posConnected;
    setPosConnected(checked);
    setSaving(true);

    const sb = posSupabase;
    const { error } = await sb.rpc("set_pos_tenant", {
      _tenant_id: tenantId,
      _provider: provider,
      _connected: checked,
      _config: {},
    });

    setSaving(false);
    if (error) {
      console.log("[AdminIntegrations] set_pos_tenant error:", error);
      setPosConnected(prev);
      if ((error as { code?: string }).code === "23505") {
        toast({ title: "Conflicto", description: "Ya hay un POS conectado en este ámbito", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "No se pudo actualizar el POS", variant: "destructive" });
      }
    } else {
      toast({ title: "Actualizado", description: checked ? "POS conectado" : "POS desconectado" });
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
      
      <Tabs defaultValue="pos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pos">POS Systems</TabsTrigger>
          <TabsTrigger value="status">POS Status</TabsTrigger>
          <TabsTrigger value="chaos">Chaos Testing</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pos">
          <Card>
            <CardHeader><CardTitle>POS</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="pos-provider">Proveedor</Label>
                  <Select value={provider} onValueChange={(v) => setProvider(v as AppPosProvider)} disabled={loading || saving}>
                    <SelectTrigger id="pos-provider" className="w-40"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fudo">Fudo</SelectItem>
                      <SelectItem value="maxirest">Maxirest</SelectItem>
                      <SelectItem value="bistrosoft">Bistrosoft</SelectItem>
                      <SelectItem value="other">ERP/Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={posConnected} onCheckedChange={onToggle} disabled={loading || saving} />
                  <Label>{loading ? "Cargando..." : posConnected ? "Conectado" : "Desconectado"}</Label>
                </div>
              </div>

              <div className="text-sm">
                <a href="/admin/integrations/pos/status" className="underline underline-offset-4">Ver estado y errores</a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="status">
          <PosStatus />
        </TabsContent>
        
        <TabsContent value="chaos">
          <ChaosTestDashboard />
        </TabsContent>
      </Tabs>
    </article>
  );
}