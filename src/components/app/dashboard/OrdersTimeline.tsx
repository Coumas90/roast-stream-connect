import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Package, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useOrderHistory } from "@/hooks/useOrderHistory";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface OrdersTimelineProps {
  locationId?: string;
}

const statusConfig = {
  draft: { 
    label: 'Borrador', 
    variant: 'secondary' as const, 
    icon: Clock 
  },
  pending: { 
    label: 'Pendiente', 
    variant: 'default' as const, 
    icon: AlertCircle 
  },
  approved: { 
    label: 'Aprobado', 
    variant: 'default' as const, 
    icon: CheckCircle 
  },
  rejected: { 
    label: 'Rechazado', 
    variant: 'destructive' as const, 
    icon: XCircle 
  },
  delivered: { 
    label: 'Entregado', 
    variant: 'default' as const, 
    icon: Package 
  }
};

export function OrdersTimeline({ locationId }: OrdersTimelineProps) {
  const { data: orders, isLoading } = useOrderHistory(locationId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Historial de Pedidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Historial de Pedidos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {orders?.length === 0 ? (
          <div className="text-center py-6">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No hay pedidos registrados</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders?.slice(0, 5).map((order) => {
              const status = statusConfig[order.status] || statusConfig.draft;
              const StatusIcon = status.icon;
              
              return (
                <div key={order.id} className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex-shrink-0 mt-0.5">
                    <StatusIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          Pedido #{order.id.slice(-6)}
                        </span>
                        <Badge variant={status.variant}>
                          {status.label}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(order.proposed_at), { 
                          addSuffix: true,
                          locale: es 
                        })}
                      </span>
                    </div>
                    {order.coffee_variety && (
                      <p className="text-sm text-muted-foreground truncate">
                        {order.coffee_variety}
                      </p>
                    )}
                    {order.notes && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {order.notes}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}