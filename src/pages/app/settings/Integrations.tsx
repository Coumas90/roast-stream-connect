import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PosConnectModal from "@/components/app/PosConnectModal";
import { useEffectivePos, usePosActions } from "@/hooks/usePosProvider";
import { useUserRole } from "@/hooks/useTeam";
import type { AppPosProvider } from "@/integrations/supabase/pos-types";

const providerLabels: Record<AppPosProvider, string> = {
  fudo: "Fudo",
  maxirest: "Maxirest",
  bistrosoft: "Bistrosoft",
  other: "ERP/Otro",
};

export default function AppIntegrations() {
  const { provider, source, connected, isLoading } = useEffectivePos();
  const { disconnect } = usePosActions();
  const { data: userRole } = useUserRole();
  const canManage = userRole === "owner" || userRole === "manager";

  const [open, setOpen] = useState(false);
  const [defaultProvider, setDefaultProvider] = useState<AppPosProvider | undefined>(undefined);

  const onDisconnect = async () => {
    if (!provider) return;
    try {
      await disconnect(provider);
    } catch {}
  };

  const pedirAlAdmin = () => {
    const subject = encodeURIComponent("Solicitud de cambio de POS");
    const body = encodeURIComponent("Hola, necesito cambiar el proveedor de POS para mi sucursal en TUPÁ Hub. Gracias.");
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <article>
      <Helmet>
        <title>Integraciones | TUPÁ Hub</title>
        <meta name="description" content="Integraciones del portal cliente" />
        <link rel="canonical" href="/app/settings/integrations" />
      </Helmet>
      <h1 className="sr-only">Integraciones</h1>

      <Card>
        <CardHeader>
          <CardTitle>POS</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            {isLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <>
                <Switch checked={connected} disabled aria-label="Estado POS" />
                <Label>{connected ? "Conectado" : "Desconectado"}</Label>
              </>
            )}
          </div>

          <div className="text-sm text-muted-foreground min-w-[16rem]">
            {isLoading ? (
              <Skeleton className="h-4 w-48" />
            ) : (
              <>
                <span className="mr-4">Proveedor: {provider ? providerLabels[provider] : "—"}</span>
                <span>Origen: {source ? (source === "location" ? "Sucursal" : "Tenant") : "—"}</span>
              </>
            )}
          </div>

          {/* CTAs por rol */}
          {!isLoading && canManage ? (
            <div className="ml-auto flex items-center gap-2">
              {!connected ? (
                <Button
                  onClick={() => {
                    setDefaultProvider(undefined);
                    setOpen(true);
                  }}
                >
                  Conectar POS
                </Button>
              ) : source === "location" ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setDefaultProvider(provider!);
                      setOpen(true);
                    }}
                  >
                    Cambiar proveedor
                  </Button>
                  <Button variant="outline" onClick={onDisconnect}>
                    Desconectar
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={pedirAlAdmin}>
                  Pedir al Admin
                </Button>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <PosConnectModal open={open} onOpenChange={setOpen} defaultProvider={defaultProvider} />
    </article>
  );
}
