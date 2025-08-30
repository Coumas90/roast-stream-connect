import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/lib/tenant";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

export default function Replenishment() {
  const { tenantId, location, locationId } = useTenant();
  const { isLoading, error, flags, tenantPos, posEffective, refetch } = useFeatureFlags();
  
  // Separar lógica de habilitación
  const manualOrdersEnabled = flags.auto_order_enabled;
  const aiOrdersEnabled = flags.auto_order_enabled && posEffective;

  const handleCreateManual = async () => {
    if (!tenantId || !locationId) {
      toast({ title: "Sin ubicación", description: "Selecciona una sucursal válida", variant: "destructive" });
      return;
    }
    if (!manualOrdersEnabled) {
      toast({ title: "No disponible", description: "Los pedidos manuales están deshabilitados para esta sucursal" });
      return;
    }
    const items = [{ code: "ESP1KG", qty: 2 }, { code: "FIL1KG", qty: 1 }];
    const { data, error } = await supabase
      .from("order_proposals")
      .insert({ tenant_id: tenantId, location_id: locationId, items, source: "manual", status: "draft" })
      .select("id")
      .maybeSingle();
    if (error) {
      console.log("[Replenishment] manual order error:", error);
      toast({ title: "Error", description: "No se pudo crear el pedido manual", variant: "destructive" });
      return;
    }
    toast({ title: "Pedido manual creado", description: `#${data?.id ?? ""} para ${location}` });
  };

  const handleCreateAI = async () => {
    if (!tenantId || !locationId) {
      toast({ title: "Sin ubicación", description: "Selecciona una sucursal válida", variant: "destructive" });
      return;
    }
    if (!aiOrdersEnabled) {
      toast({ title: "No disponible", description: "Las propuestas IA requieren POS conectado", variant: "destructive" });
      return;
    }
    const items = [{ code: "ESP1KG", qty: 3 }, { code: "FIL1KG", qty: 2 }, { code: "CAP500G", qty: 1 }]; // Propuesta IA simulada
    const { data, error } = await supabase
      .from("order_proposals")
      .insert({ tenant_id: tenantId, location_id: locationId, items, source: "ai", status: "draft" })
      .select("id")
      .maybeSingle();
    if (error) {
      console.log("[Replenishment] AI order error:", error);
      toast({ title: "Error", description: "No se pudo crear la propuesta IA", variant: "destructive" });
      return;
    }
    toast({ title: "Propuesta IA creada", description: `#${data?.id ?? ""} para ${location}` });
  };

  return (
    <article>
      <Helmet>
        <title>Reposición | TUPÁ Hub</title>
        <meta name="description" content="Propuesta de pedido y creación" />
        <link rel="canonical" href="/app/replenishment" />
      </Helmet>
      <h1 className="sr-only">Reposición</h1>
      
      <div className="space-y-6">
        {/* Pedidos Manuales */}
        <Card>
          <CardHeader>
            <CardTitle>Pedido Manual</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Crea un pedido con productos predefinidos
            </p>
            <p className="text-sm font-medium">
              2 x Espresso Blend 1kg • 1 x House Filter 1kg
            </p>
            {(isLoading || error || !manualOrdersEnabled) && (
              <div className="mt-4">
                {isLoading ? (
                  <div className="h-10 w-full rounded bg-muted" />
                ) : error ? (
                  <Alert variant="destructive">
                    <AlertTitle>Error de configuración</AlertTitle>
                    <AlertDescription>
                      No se pudieron cargar los permisos. <button className="underline" onClick={() => refetch()}>Reintentar</button>
                    </AlertDescription>
                  </Alert>
                ) : !manualOrdersEnabled ? (
                  <Alert>
                    <AlertTitle>Pedidos manuales deshabilitados</AlertTitle>
                    <AlertDescription>
                      La función de pedidos manuales está desactivada para esta sucursal.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={handleCreateManual} disabled={isLoading || !manualOrdersEnabled}>
              Crear Pedido Manual
            </Button>
          </CardFooter>
        </Card>

        {/* Propuestas IA */}
        <Card>
          <CardHeader>
            <CardTitle>Propuesta IA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Propuesta inteligente basada en datos del POS
            </p>
            <p className="text-sm font-medium">
              3 x Espresso Blend 1kg • 2 x House Filter 1kg • 1 x Cappuccino Mix 500g
            </p>
            {(isLoading || error || !aiOrdersEnabled) && (
              <div className="mt-4">
                {isLoading ? (
                  <div className="h-10 w-full rounded bg-muted" />
                ) : error ? (
                  <Alert variant="destructive">
                    <AlertTitle>Error de configuración</AlertTitle>
                    <AlertDescription>
                      No se pudieron cargar los permisos. <button className="underline" onClick={() => refetch()}>Reintentar</button>
                    </AlertDescription>
                  </Alert>
                ) : !aiOrdersEnabled ? (
                  <Alert>
                    <AlertTitle>Propuestas IA no disponibles</AlertTitle>
                    <AlertDescription>
                      {!flags.auto_order_enabled ? (
                        <>La función de auto pedido está desactivada para esta sucursal.</>
                      ) : !posEffective ? (
                        tenantPos ? (
                          flags.pos_connected ? (
                            <>POS conectado pero no efectivo en esta sucursal.</>
                          ) : (
                            <>POS conectado a nivel tenant, pero deshabilitado en esta sucursal.</>
                          )
                        ) : (
                          <>No hay POS conectado a nivel tenant.</>
                        )
                      ) : (
                        <>Las propuestas IA requieren POS conectado.</>
                      )}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={handleCreateAI} disabled={isLoading || !aiOrdersEnabled}>
              Generar Propuesta IA
            </Button>
          </CardFooter>
        </Card>
      </div>
    </article>
  );
}
