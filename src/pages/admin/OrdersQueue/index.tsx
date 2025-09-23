import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenant } from "@/lib/tenant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Tables, Enums } from "@/integrations/supabase/types";
import { OrdersKPIDashboard } from "@/components/admin/orders/OrdersKPIDashboard";
import { OrdersFilters } from "@/components/admin/orders/OrdersFilters";
import { OrderCard } from "@/components/admin/orders/OrderCard";
import { KanbanBoard } from "@/components/admin/orders/KanbanBoard";
import { ViewToggle } from "@/components/admin/orders/ViewToggle";

interface OrderWithDetails extends Tables<"order_proposals"> {
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

export default function OrdersQueue() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [tenants, setTenants] = useState<Array<Tables<"tenants">>>([]);
  const [locations, setLocations] = useState<Array<Tables<"locations">>>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [filters, setFilters] = useState({
    tenantId: "",
    locationId: "",
    status: "",
  });
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: ordersData, error: ordersError } = await supabase
        .from("order_proposals")
        .select(`
          *,
          order_items (
            id,
            coffee_variety_id,
            quantity_kg,
            unit_price,
            notes,
            coffee_varieties (
              name,
              category
            )
          ),
          locations (
            name,
            tenant_id,
            tenants (
              name
            )
          )
        `)
        .order("proposed_at", { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);
    } catch (error) {
      console.error("[OrdersQueue] fetch error:", error);
      toast({ 
        title: "Error", 
        description: "No se pudieron cargar los pedidos", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTenants = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("name");
      
      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      console.error("[OrdersQueue] fetch tenants error:", error);
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .order("name");
      
      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error("[OrdersQueue] fetch locations error:", error);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchTenants();
    fetchLocations();
    
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
  }, [fetchOrders, fetchTenants, fetchLocations]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (filters.tenantId && order.tenant_id !== filters.tenantId) return false;
      if (filters.locationId && order.location_id !== filters.locationId) return false;
      if (filters.status && order.status !== filters.status) return false;
      return true;
    });
  }, [orders, filters]);

  const updateOrderStatus = async (id: string, status: Enums<"order_status">) => {
    try {
      const { error } = await supabase
        .from("order_proposals")
        .update({ status })
        .eq("id", id);
      
      if (error) throw error;
      
      toast({ 
        title: "Actualizado", 
        description: `Pedido #${id.slice(0, 8)} marcado como ${status}` 
      });
      fetchOrders();
    } catch (error) {
      console.error("[OrdersQueue] update error:", error);
      toast({ 
        title: "Error", 
        description: "No se pudo actualizar el pedido", 
        variant: "destructive" 
      });
    }
  };

  return (
    <article className="space-y-6">
      <Helmet>
        <title>Cola de Pedidos | TUPÁ Hub</title>
        <meta name="description" content="Gestión de pedidos de café para todas las sucursales" />
        <link rel="canonical" href="/admin/orders-queue" />
      </Helmet>
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cola de Pedidos</h1>
          <p className="text-muted-foreground">
            Gestiona los pedidos de todas las sucursales desde un solo lugar
          </p>
        </div>
        <ViewToggle view={view} onViewChange={setView} />
      </div>

      <OrdersKPIDashboard orders={filteredOrders} />

      <OrdersFilters
        tenants={tenants}
        locations={locations}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Cargando pedidos...</div>
          </CardContent>
        </Card>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-muted-foreground text-lg mb-2">No hay pedidos</div>
            <p className="text-sm text-muted-foreground">
              {filters.tenantId || filters.locationId || filters.status
                ? "No se encontraron pedidos con los filtros aplicados"
                : "Aún no hay pedidos registrados"}
            </p>
          </CardContent>
        </Card>
      ) : view === "kanban" ? (
        <KanbanBoard
          orders={filteredOrders}
          onUpdateStatus={updateOrderStatus}
        />
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              location={order.locations}
              tenant={order.locations?.tenants}
              items={order.order_items}
              onUpdateStatus={updateOrderStatus}
            />
          ))}
        </div>
      )}
    </article>
  );
}
