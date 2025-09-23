import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KanbanCard } from "./KanbanCard";

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

interface KanbanColumnProps {
  id: string;
  title: string;
  color: string;
  orders: OrderWithDetails[];
  draggedOrder: string | null;
  isDraggedOver: boolean;
  onDragStart: (orderId: string) => void;
  onDragEnd: () => void;
  onDragOver: (columnId: string) => void;
  onDragLeave: () => void;
}

export function KanbanColumn({ 
  id, 
  title, 
  color, 
  orders, 
  draggedOrder, 
  isDraggedOver,
  onDragStart, 
  onDragEnd,
  onDragOver,
  onDragLeave 
}: KanbanColumnProps) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    onDragOver(id);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    onDragLeave();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDragEnd();
  };

  return (
    <div className="min-w-80 flex-shrink-0">
      <Card 
        className={`h-full transition-all ${color} ${
          isDraggedOver ? "ring-2 ring-primary ring-offset-2 scale-105" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Badge variant="secondary" className="bg-white/50">
              {orders.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
          {orders.map((order) => (
            <KanbanCard
              key={order.id}
              order={order}
              isDragged={draggedOrder === order.id}
              onDragStart={onDragStart}
            />
          ))}
          {orders.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              No hay pedidos en este estado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}