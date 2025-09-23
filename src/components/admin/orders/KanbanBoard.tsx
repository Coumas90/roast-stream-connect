import React, { useState } from "react";
import { motion } from "framer-motion";
import { KanbanColumn } from "./KanbanColumn";
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

interface KanbanBoardProps {
  orders: OrderWithDetails[];
  onUpdateStatus: (orderId: string, status: "approved" | "sent" | "fulfilled" | "cancelled") => void;
}

const COLUMNS = [
  { id: "draft", title: "Borrador", color: "bg-blue-50 border-blue-200" },
  { id: "approved", title: "Aprobado", color: "bg-green-50 border-green-200" },
  { id: "sent", title: "Enviado", color: "bg-amber-50 border-amber-200" },
  { id: "fulfilled", title: "Entregado", color: "bg-emerald-50 border-emerald-200" },
  { id: "cancelled", title: "Cancelado", color: "bg-red-50 border-red-200" },
];

export function KanbanBoard({ orders, onUpdateStatus }: KanbanBoardProps) {
  const [draggedOrder, setDraggedOrder] = useState<string | null>(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);

  const ordersByStatus = React.useMemo(() => {
    return COLUMNS.reduce((acc, column) => {
      acc[column.id] = orders.filter(order => order.status === column.id);
      return acc;
    }, {} as Record<string, OrderWithDetails[]>);
  }, [orders]);

  const handleDragStart = (orderId: string) => {
    setDraggedOrder(orderId);
  };

  const handleDragEnd = () => {
    if (draggedOrder && draggedOverColumn) {
      const order = orders.find(o => o.id === draggedOrder);
      
      if (order && order.status !== draggedOverColumn) {
        // Only allow valid status transitions
        const validTransitions: Record<string, string[]> = {
          draft: ["approved", "cancelled"],
          approved: ["sent", "cancelled"],
          sent: ["fulfilled"],
          fulfilled: [],
          cancelled: []
        };

        if (validTransitions[order.status]?.includes(draggedOverColumn)) {
          onUpdateStatus(draggedOrder, draggedOverColumn as any);
        }
      }
    }
    
    setDraggedOrder(null);
    setDraggedOverColumn(null);
  };

  const handleDragOver = (columnId: string) => {
    setDraggedOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDraggedOverColumn(null);
  };

  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {COLUMNS.map((column) => (
        <KanbanColumn
          key={column.id}
          id={column.id}
          title={column.title}
          color={column.color}
          orders={ordersByStatus[column.id] || []}
          draggedOrder={draggedOrder}
          isDraggedOver={draggedOverColumn === column.id}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        />
      ))}
    </div>
  );
}