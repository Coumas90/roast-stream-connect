import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/lib/tenant";
import { useDataStore } from "@/lib/data-store";
import { toast } from "@/hooks/use-toast";

export default function Replenishment() {
  const { tenantId, location } = useTenant();
  const { createOrder } = useDataStore();

  const handleCreate = () => {
    const order = createOrder(tenantId, location);
    toast({ title: "Pedido creado", description: `#${order.id} para ${location}` });
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
