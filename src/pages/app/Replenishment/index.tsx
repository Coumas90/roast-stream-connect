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
  const disabled = !flags.auto_order_enabled || !posEffective;

  const handleCreate = async () => {
    if (!tenantId || !locationId) {
      toast({ title: "Sin ubicación", description: "Selecciona una sucursal válida", variant: "destructive" });
      return;
    }
    if (disabled) {
      toast({ title: "No disponible", description: "La reposición está deshabilitada para esta sucursal" });
      return;
    }
    const items = [{ code: "ESP1KG", qty: 2 }, { code: "FIL1KG", qty: 1 }];
    const { data, error } = await supabase
      .from("order_proposals")
      .insert({ tenant_id: tenantId, location_id: locationId, items, source: "manual", status: "draft" })
      .select("id")
      .maybeSingle();
    if (error) {
      console.log("[Replenishment] create error:", error);
      toast({ title: "Error", description: "No se pudo crear el pedido", variant: "destructive" });
      return;
    }
    toast({ title: "Pedido creado", description: `#${data?.id ?? ""} para ${location}` });
  };

  return (
    <article>
      <Helmet>
        <title>Reposición | TUPÁ Hub</title>
        <meta name="description" content="Propuesta de pedido y creación" />
        <link rel="canonical" href="/app/replenishment" />
      </Helmet>
      <h1 className="sr-only">Reposición</h1>
      <Card>
        <CardHeader>
          <CardTitle>Propuesta IA</CardTitle>
        </CardHeader>
        <CardContent>
          2 x Espresso Blend 1kg • 1 x House Filter 1kg
          {(isLoading || error || disabled) && (
            <div className="mt-4">
              {isLoading ? (
                <div className="h-10 w-full rounded bg-muted" />
              ) : error ? (
                <Alert variant="destructive">
                  <AlertTitle>Error de flags</AlertTitle>
                  <AlertDescription>
                    No se pudieron cargar los permisos. <button className="underline" onClick={() => refetch()}>Reintentar</button>
                  </AlertDescription>
                </Alert>
              ) : disabled ? (
                <Alert>
                  <AlertTitle>Reposición deshabilitada</AlertTitle>
                  <AlertDescription>
                    {tenantPos ? (
                      flags.pos_connected ? (
                        <>La función de auto pedido está desactivada para esta sucursal.</>
                      ) : (
                        <>POS conectado a nivel tenant, pero deshabilitado en esta sucursal.</>
                      )
                    ) : (
                      <>No hay POS conectado a nivel tenant.</>
                    )}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleCreate} disabled={isLoading || disabled}>Crear pedido</Button>
        </CardFooter>
      </Card>
    </article>
  );
}
