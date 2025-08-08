import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDataStore } from "@/lib/data-store";

export default function OrdersQueue() {
  const { ordersQueue, updateOrderStatus } = useDataStore();
  return (
    <article>
      <Helmet>
        <title>Cola de Pedidos | TUPÁ Hub</title>
        <meta name="description" content="Pedidos pendientes hacia Odoo" />
        <link rel="canonical" href="/admin/orders-queue" />
      </Helmet>
      <h1 className="sr-only">Cola de Pedidos</h1>
      <Card>
        <CardHeader><CardTitle>Pedidos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {ordersQueue.length === 0 && <div>No hay pedidos pendientes.</div>}
          {ordersQueue.map((o) => (
            <div key={o.id} className="flex items-center justify-between border rounded-md p-3">
              <div>
                <div className="font-medium">#{o.id}</div>
                <div className="text-sm text-muted-foreground">{o.tenant} • {o.location} • {o.status}</div>
              </div>
              <div className="flex gap-2">
                {o.status === "pending" && (
                  <Button size="sm" onClick={() => updateOrderStatus(o.id, "approved")}>Aprobar</Button>
                )}
                {o.status === "approved" && (
                  <Button size="sm" onClick={() => updateOrderStatus(o.id, "sent")}>Enviar</Button>
                )}
                {o.status === "sent" && (
                  <Button size="sm" onClick={() => updateOrderStatus(o.id, "delivered")}>Marcar entregado</Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </article>
  );
}
