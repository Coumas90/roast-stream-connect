import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin, Package2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface OrderWithDetails {
  id: string;
  status: "draft" | "approved" | "sent" | "fulfilled" | "cancelled";
  proposed_at: string;
  location_id: string;
  notes?: string;
  source: string;
  odoo_so_number?: string;
  created_by?: string;
  order_items?: Array<{
    id: string;
    coffee_variety_id: string;
    quantity_kg: number;
    unit_price?: number;
    notes?: string;
    coffee_varieties?: {
      name: string;
      category: string;
    };
  }>;
  locations?: {
    name: string;
    tenant_id: string;
    tenants?: {
      name: string;
    };
  };
}

interface KanbanCardProps {
  order: OrderWithDetails;
  isDragged: boolean;
  onDragStart: (orderId: string) => void;
}

const statusConfig = {
  draft: { label: "Borrador", variant: "secondary" as const },
  approved: { label: "Aprobado", variant: "default" as const },
  sent: { label: "Enviado", variant: "default" as const },
  fulfilled: { label: "Entregado", variant: "default" as const },
  cancelled: { label: "Cancelado", variant: "destructive" as const },
};

export function KanbanCard({ order, isDragged, onDragStart }: KanbanCardProps) {
  const statusInfo = statusConfig[order.status];
  
  const totalKg = order.order_items?.reduce((sum, item) => sum + item.quantity_kg, 0) || 0;
  const totalValue = order.order_items?.reduce((sum, item) => {
    return sum + (item.unit_price ? item.quantity_kg * item.unit_price : 0);
  }, 0) || 0;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", order.id);
    onDragStart(order.id);
  };

  return (
    <Card 
      className={`cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${
        isDragged ? "opacity-50 rotate-2 scale-105" : ""
      }`}
      draggable
      onDragStart={handleDragStart}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm">#{order.id.slice(0, 8)}</h4>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="w-3 h-3" />
              {format(new Date(order.proposed_at), "dd/MM", { locale: es })}
            </div>
          </div>
          {order.odoo_so_number && (
            <Badge variant="outline" className="text-xs">
              SO: {order.odoo_so_number}
            </Badge>
          )}
        </div>

        {/* Location */}
        <div className="flex items-center gap-2 text-xs">
          <MapPin className="w-3 h-3 text-muted-foreground" />
          <span className="font-medium truncate">
            {order.locations?.name || "Sucursal no encontrada"}
          </span>
        </div>

        {/* Items Summary */}
        {order.order_items && order.order_items.length > 0 && (
          <div className="bg-muted/30 rounded-md p-2 space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Package2 className="w-3 h-3" />
              <span>{order.order_items.length} producto(s)</span>
            </div>
            <div className="text-xs font-medium">
              Total: {totalKg} kg
              {totalValue > 0 && (
                <span className="text-muted-foreground ml-2">
                  (${totalValue.toFixed(2)})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded p-2">
            {order.notes.length > 50 ? `${order.notes.slice(0, 50)}...` : order.notes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}