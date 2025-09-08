import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, Package, AlertCircle } from "lucide-react";

interface OrderKPIProps {
  orders: Array<{
    id: string;
    status: "draft" | "approved" | "sent" | "fulfilled" | "cancelled";
    location_id: string;
    proposed_at: string;
  }>;
}

export function OrdersKPIDashboard({ orders }: OrderKPIProps) {
  const kpis = React.useMemo(() => {
    const draft = orders.filter(o => o.status === "draft").length;
    const approved = orders.filter(o => o.status === "approved").length;
    const sent = orders.filter(o => o.status === "sent").length;
    const fulfilled = orders.filter(o => o.status === "fulfilled").length;
    const total = orders.length;

    // Calcular pendientes (draft + approved + sent)
    const pending = draft + approved + sent;

    return { draft, approved, sent, fulfilled, total, pending };
  }, [orders]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.total}</div>
          <p className="text-xs text-muted-foreground">Pedidos totales</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
          <Clock className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">{kpis.pending}</div>
          <p className="text-xs text-muted-foreground">Requieren acción</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Borradores</CardTitle>
          <AlertCircle className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{kpis.draft}</div>
          <p className="text-xs text-muted-foreground">Por aprobar</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completados</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{kpis.fulfilled}</div>
          <p className="text-xs text-muted-foreground">Entregados</p>
        </CardContent>
      </Card>
    </div>
  );
}