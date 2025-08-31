import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/lib/tenant";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { Clock, Package, AlertCircle, TrendingUp } from "lucide-react";
import type { Enums } from "@/integrations/supabase/types";

type OrderStatus = Enums<"order_status">;

interface OrderProposal {
  id: string;
  status: OrderStatus;
  coffee_variety: string;
  items: { code: string; qty: number }[];
  source: string;
  delivery_type: string;
  notes: string;
  proposed_at: string;
}

export default function Replenishment() {
  const { tenantId, location, locationId } = useTenant();
  const { isLoading, error, flags, tenantPos, posEffective, refetch } = useFeatureFlags();
  
  // Form state
  const [formData, setFormData] = useState({
    coffeeVariety: "",
    quantity: "",
    deliveryType: "",
    notes: ""
  });
  
  // Orders state
  const [orders, setOrders] = useState<OrderProposal[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  
  // Feature flags
  const manualOrdersEnabled = flags.auto_order_enabled;
  const aiOrdersEnabled = flags.auto_order_enabled && posEffective;
  
  // AI Recommendation data (mock)
  const aiRecommendation = {
    product: "Espresso Blend Premium",
    quantity: 15,
    currentStock: "8kg",
    reason: "Basado en tu consumo promedio y stock actual",
    urgency: "media" as const
  };

  // Load existing orders
  useEffect(() => {
    loadOrders();
  }, [locationId]);

  const loadOrders = async () => {
    if (!locationId) return;
    
    setLoadingOrders(true);
    const { data, error } = await supabase
      .from("order_proposals")
      .select("id, status, coffee_variety, items, source, delivery_type, notes, proposed_at")
      .eq("location_id", locationId)
      .order("proposed_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error loading orders:", error);
    } else {
      // Transform data to match our interface
      const transformedOrders: OrderProposal[] = (data || []).map(order => ({
        id: order.id,
        status: order.status,
        coffee_variety: order.coffee_variety || "",
        items: Array.isArray(order.items) ? order.items as { code: string; qty: number }[] : [],
        source: order.source,
        delivery_type: order.delivery_type || "",
        notes: order.notes || "",
        proposed_at: order.proposed_at
      }));
      setOrders(transformedOrders);
    }
    setLoadingOrders(false);
  };

  const handleSubmitOrder = async () => {
    if (!tenantId || !locationId) {
      toast({ title: "Sin ubicación", description: "Selecciona una sucursal válida", variant: "destructive" });
      return;
    }
    
    if (!formData.coffeeVariety || !formData.quantity) {
      toast({ title: "Campos requeridos", description: "Completa variedad y cantidad", variant: "destructive" });
      return;
    }

    if (!manualOrdersEnabled) {
      toast({ title: "No disponible", description: "Los pedidos manuales están deshabilitados para esta sucursal" });
      return;
    }

    const items = [{ code: formData.coffeeVariety, qty: parseInt(formData.quantity) }];
    const { data, error } = await supabase
      .from("order_proposals")
      .insert({ 
        tenant_id: tenantId, 
        location_id: locationId, 
        items, 
        source: "manual", 
        status: "draft",
        coffee_variety: formData.coffeeVariety,
        delivery_type: formData.deliveryType,
        notes: formData.notes
      })
      .select("id")
      .maybeSingle();

    if (error) {
      console.log("[Replenishment] manual order error:", error);
      toast({ title: "Error", description: "No se pudo crear el pedido manual", variant: "destructive" });
      return;
    }

    toast({ title: "Pedido creado", description: `Pedido #${data?.id?.slice(0, 8) ?? ""} para ${location}` });
    
    // Reset form and reload orders
    setFormData({ coffeeVariety: "", quantity: "", deliveryType: "", notes: "" });
    loadOrders();
  };

  const handleApplyAiRecommendation = async () => {
    if (!tenantId || !locationId) {
      toast({ title: "Sin ubicación", description: "Selecciona una sucursal válida", variant: "destructive" });
      return;
    }
    
    if (!aiOrdersEnabled) {
      toast({ title: "No disponible", description: "Las propuestas IA requieren POS conectado", variant: "destructive" });
      return;
    }

    const items = [{ code: "ESP1KG", qty: aiRecommendation.quantity }];
    const { data, error } = await supabase
      .from("order_proposals")
      .insert({ 
        tenant_id: tenantId, 
        location_id: locationId, 
        items, 
        source: "ai", 
        status: "draft",
        coffee_variety: aiRecommendation.product,
        delivery_type: "standard",
        notes: `Recomendación IA: ${aiRecommendation.reason}`
      })
      .select("id")
      .maybeSingle();

    if (error) {
      console.log("[Replenishment] AI order error:", error);
      toast({ title: "Error", description: "No se pudo crear la propuesta IA", variant: "destructive" });
      return;
    }

    toast({ title: "Recomendación aplicada", description: `Pedido IA #${data?.id?.slice(0, 8) ?? ""} creado` });
    loadOrders();
  };

  const getStatusBadge = (status: OrderStatus) => {
    const variants = {
      draft: "secondary",
      pending: "outline", 
      approved: "default",
      rejected: "destructive",
      fulfilled: "secondary"
    } as const;
    
    const labels = {
      draft: "Borrador",
      pending: "Pendiente", 
      approved: "Aprobado",
      rejected: "Rechazado",
      fulfilled: "Completado"
    };
    
    return (
      <Badge variant={variants[status] || "secondary"}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Reposición | TUPÁ Hub</title>
        <meta name="description" content="Gestión completa de pedidos y reposición de stock" />
        <link rel="canonical" href="/app/replenishment" />
      </Helmet>

      <div className="flex items-center gap-2 mb-6">
        <Package className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Reposición</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form - 2 columns */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Nueva Reposición</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="coffee-variety">Variedad de Café</Label>
                  <Select 
                    value={formData.coffeeVariety} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, coffeeVariety: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona variedad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ESP1KG">Espresso Blend Premium - 1kg</SelectItem>
                      <SelectItem value="FIL1KG">House Filter Blend - 1kg</SelectItem>
                      <SelectItem value="CAP500G">Cappuccino Mix - 500g</SelectItem>
                      <SelectItem value="ORG1KG">Organic Single Origin - 1kg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Cantidad (kg)</Label>
                  <Input
                    id="quantity"
                    type="number"
                    placeholder="0"
                    min="1"
                    max="100"
                    value={formData.quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delivery-type">Tipo de Entrega</Label>
                <Select 
                  value={formData.deliveryType} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, deliveryType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tipo de entrega" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Entrega Estándar (3-5 días)</SelectItem>
                    <SelectItem value="express">Entrega Express (1-2 días)</SelectItem>
                    <SelectItem value="scheduled">Entrega Programada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observaciones</Label>
                <Textarea
                  id="notes"
                  placeholder="Notas adicionales para el pedido..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="min-h-[80px]"
                />
              </div>

              {(isLoading || error || !manualOrdersEnabled) && (
                <Alert variant={error ? "destructive" : "default"}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    {isLoading ? "Cargando..." : error ? "Error de configuración" : "Función deshabilitada"}
                  </AlertTitle>
                  <AlertDescription>
                    {isLoading ? "Verificando permisos..." : 
                     error ? <button className="underline" onClick={() => refetch()}>Reintentar</button> :
                     "Los pedidos manuales están deshabilitados para esta sucursal."
                    }
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button 
                onClick={handleSubmitOrder} 
                disabled={isLoading || !manualOrdersEnabled || !formData.coffeeVariety || !formData.quantity}
                className="flex-1"
              >
                Solicitar Reposición
              </Button>
              <Button variant="outline" disabled>
                Vista Previa
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* AI Recommendation Panel - 1 column */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recomendación IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiOrdersEnabled ? (
                <>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="font-medium text-sm">{aiRecommendation.product}</div>
                    <div className="text-2xl font-bold text-primary mt-1">{aiRecommendation.quantity}kg</div>
                    <div className="text-xs text-muted-foreground mt-1">Stock actual: {aiRecommendation.currentStock}</div>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    {aiRecommendation.reason}
                  </div>
                  
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Recomendamos reponereste producto en los próximos días para evitar desabastecimiento.
                    </AlertDescription>
                  </Alert>

                  <Button onClick={handleApplyAiRecommendation} className="w-full">
                    Aplicar Recomendación
                  </Button>
                </>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>IA no disponible</AlertTitle>
                  <AlertDescription className="text-sm">
                    {!flags.auto_order_enabled ? 
                      "La función está desactivada." : 
                      "Requiere POS conectado para generar recomendaciones."
                    }
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Order History */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Reposiciones</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingOrders ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay pedidos registrados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">
                      #{order.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      {order.coffee_variety || 
                       (order.items?.[0] ? 
                        ({ ESP1KG: "Espresso Blend", FIL1KG: "House Filter", CAP500G: "Cappuccino Mix" }[order.items[0].code] || order.items[0].code) :
                        "N/A"
                       )
                      }
                    </TableCell>
                    <TableCell>
                      {order.items?.[0]?.qty || 0}kg
                    </TableCell>
                    <TableCell>
                      <Badge variant={order.source === "ai" ? "default" : "secondary"}>
                        {order.source === "ai" ? "IA" : "Manual"}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(order.proposed_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
