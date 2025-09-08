import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, MapPin, Package2, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface OrderItem {
  id: string;
  coffee_variety_id: string;
  quantity_kg: number;
  unit_price?: number;
  notes?: string;
  coffee_varieties?: {
    name: string;
    category: string;
  };
}

interface OrderCardProps {
  order: {
    id: string;
    status: "draft" | "approved" | "sent" | "fulfilled" | "cancelled";
    proposed_at: string;
    location_id: string;
    notes?: string;
    source: string;
    odoo_so_number?: string;
    created_by?: string;
  };
  location?: {
    name: string;
    tenant_id: string;
  };
  tenant?: {
    name: string;
  };
  items?: OrderItem[];
  onUpdateStatus: (orderId: string, status: "approved" | "sent" | "fulfilled" | "cancelled") => void;
}

const statusConfig = {
  draft: { label: "Borrador", color: "bg-blue-100 text-blue-800", variant: "secondary" as const },
  approved: { label: "Aprobado", color: "bg-green-100 text-green-800", variant: "default" as const },
  sent: { label: "Enviado", color: "bg-amber-100 text-amber-800", variant: "default" as const },
  fulfilled: { label: "Entregado", color: "bg-emerald-100 text-emerald-800", variant: "default" as const },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800", variant: "destructive" as const },
};

export function OrderCard({ order, location, tenant, items = [], onUpdateStatus }: OrderCardProps) {
  const statusInfo = statusConfig[order.status];

  const totalKg = items.reduce((sum, item) => sum + item.quantity_kg, 0);
  const totalValue = items.reduce((sum, item) => {
    return sum + (item.unit_price ? item.quantity_kg * item.unit_price : 0);
  }, 0);

  const nextActions = React.useMemo(() => {
    switch (order.status) {
      case "draft":
        return [
          { label: "Aprobar", status: "approved" as const, variant: "default" as const },
          { label: "Cancelar", status: "cancelled" as const, variant: "destructive" as const },
        ];
      case "approved":
        return [
          { label: "Enviar", status: "sent" as const, variant: "default" as const },
          { label: "Cancelar", status: "cancelled" as const, variant: "destructive" as const },
        ];
      case "sent":
        return [
          { label: "Marcar entregado", status: "fulfilled" as const, variant: "default" as const },
        ];
      default:
        return [];
    }
  }, [order.status]);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">#{order.id.slice(0, 8)}</h3>
              <Badge variant={statusInfo.variant} className={statusInfo.color}>
                {statusInfo.label}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <CalendarDays className="w-4 h-4" />
                {format(new Date(order.proposed_at), "dd 'de' MMM, yyyy 'a las' HH:mm", { locale: es })}
              </div>
              {order.source && (
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {order.source}
                </div>
              )}
            </div>
          </div>
          {order.odoo_so_number && (
            <Badge variant="outline">
              SO: {order.odoo_so_number}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Location & Tenant Info */}
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{location?.name || "Sucursal no encontrada"}</span>
          {tenant && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{tenant.name}</span>
            </>
          )}
        </div>

        {/* Order Items */}
        {items.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Package2 className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Productos solicitados</span>
            </div>
            <div className="bg-muted/50 rounded-md p-3 space-y-2">
              {items.map((item, index) => (
                <div key={item.id} className="flex justify-between items-center text-sm">
                  <div className="flex-1">
                    <span className="font-medium">
                      {item.coffee_varieties?.name || "Variedad no encontrada"}
                    </span>
                    {item.coffee_varieties?.category && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {item.coffee_varieties.category}
                      </Badge>
                    )}
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{item.quantity_kg} kg</div>
                    {item.unit_price && (
                      <div className="text-xs text-muted-foreground">
                        ${item.unit_price}/kg
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              <Separator />
              
              <div className="flex justify-between items-center font-medium">
                <span>Total</span>
                <div className="text-right">
                  <div>{totalKg} kg</div>
                  {totalValue > 0 && (
                    <div className="text-sm text-muted-foreground">
                      ${totalValue.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              <strong>Notas:</strong> {order.notes}
            </p>
          </div>
        )}

        {/* Actions */}
        {nextActions.length > 0 && (
          <div className="flex gap-2 pt-2">
            {nextActions.map((action) => (
              <Button
                key={action.status}
                variant={action.variant}
                size="sm"
                onClick={() => onUpdateStatus(order.id, action.status)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}