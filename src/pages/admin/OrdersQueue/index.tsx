import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/lib/tenant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function OrdersQueue() {
  const { tenantId, locationId, locations, getLocationIdByName } = useTenant();
  const [orders, setOrders] = useState<Array<{ id: string; location_id: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Mapeo opcional id->nombre si hiciera falta mostrarlo
  // (por simplicidad, mostramos location_id)

  const fetchOrders = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("order_proposals")
      .select("id, location_id, status")
      .eq("tenant_id", tenantId)
      .order("proposed_at", { ascending: false });
    if (error) {
      console.log("[OrdersQueue] list error:", error);
      toast({ title: "Error", description: "No se pudieron cargar los pedidos", variant: "destructive" });
    }
    setOrders((data ?? []) as any);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel("order_proposals_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_proposals" },
        () => fetchOrders()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "order_proposals" },
        () => fetchOrders()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders]);

  const updateOrderStatus = async (id: string, status: "approved" | "sent" | "delivered") => {
    const { error } = await supabase
      .from("order_proposals")
      .update({ status })
      .eq("id", id);
    if (error) {
      console.log("[OrdersQueue] update error:", error);
      toast({ title: "Error", description: "No se pudo actualizar el pedido", variant: "destructive" });
    } else {
      toast({ title: "Actualizado", description: `#${id} → ${status}` });
      fetchOrders();
    }
  };

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
          {loading && <div>Cargando...</div>}
          {!loading && orders.length === 0 && <div>No hay pedidos.</div>}
          {orders.map((o) => (
            <div key={o.id} className="flex items-center justify-between border rounded-md p-3">
              <div>
                <div className="font-medium">#{o.id}</div>
                <div className="text-sm text-muted-foreground">{o.location_id} • {o.status}</div>
              </div>
              <div className="flex gap-2">
                {o.status === "draft" && (
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
