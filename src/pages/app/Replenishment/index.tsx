import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/lib/tenant";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Replenishment() {
  const { tenantId, location, locationId } = useTenant();

  const handleCreate = async () => {
    if (!tenantId || !locationId) {
      toast({ title: "Sin ubicación", description: "Selecciona una sucursal válida", variant: "destructive" });
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
        </CardContent>
        <CardFooter>
          <Button onClick={handleCreate}>Crear pedido</Button>
        </CardFooter>
      </Card>
    </article>
  );
}
