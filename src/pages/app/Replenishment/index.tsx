import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { EnhancedCoffeeSelector, OrderItem } from "@/components/replenishment/EnhancedCoffeeSelector";
import { EnhancedCoffeeSelectorV2, GroundCoffeeOrderItem, ProductOrderItem } from "@/components/replenishment/EnhancedCoffeeSelectorV2";
import LocationSwitcher from "@/components/app/LocationSwitcher";
import AppLayout from "@/layouts/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/lib/tenant";
import { 
  Coffee, 
  Package, 
  TrendingUp, 
  Calendar, 
  AlertTriangle,
  Truck,
  Bot,
  ShoppingCart,
  Clock
} from "lucide-react";

// Order proposal interface
interface OrderProposal {
  id: string;
  status: string;
  coffee_variety: string | null;
  items: any;
  source: string;
  delivery_type: string | null;
  notes: string | null;
  proposed_at: string;
}

export default function ReplenishmentPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { location, locationId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderProposal[]>([]);
  
  // Form state for manual orders - new enhanced system
  const [selectedGroundItems, setSelectedGroundItems] = useState<GroundCoffeeOrderItem[]>([]);
  const [selectedProductItems, setSelectedProductItems] = useState<ProductOrderItem[]>([]);
  
  // Legacy form state for backward compatibility
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [formData, setFormData] = useState({
    delivery_type: "standard",
    notes: "",
  });

  // Mock feature flags for now
  const manualOrdersEnabled = true;
  const aiOrdersEnabled = true;

  // Mock AI recommendation
  const aiRecommendation = {
    product: "TUPÁ Supremo",
    quantity: 15,
    currentStock: "8kg",
    reason: "Basado en tu consumo promedio y stock actual",
    urgency: "media" as const
  };

  // Load orders when location changes
  useEffect(() => {
    if (locationId) {
      loadOrders();
    }
  }, [locationId]);

  const loadOrders = async () => {
    if (!locationId) return;
    
    try {
      const { data, error } = await supabase
        .from('order_proposals')
        .select('*')
        .eq('location_id', locationId)
        .order('proposed_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('Error loading orders:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los pedidos",
        variant: "destructive"
      });
    }
  };

  const handleSubmitOrder = async () => {
    if (!locationId) {
      toast({
        title: "Error",
        description: "Selecciona una ubicación",
        variant: "destructive"
      });
      return;
    }

    if (!manualOrdersEnabled) {
      toast({
        title: "Pedidos manuales deshabilitados",
        description: "Esta función está temporalmente deshabilitada",
        variant: "destructive"
      });
      return;
    }

    if (selectedItems.length === 0) {
      toast({
        title: "Error",
        description: "Selecciona al menos una variedad de café",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const { data: locationData } = await supabase
        .from('locations')
        .select('tenant_id')
        .eq('id', locationId)
        .single();

      if (!locationData) {
        throw new Error('No se pudo obtener información de la ubicación');
      }

      // Create the order proposal
      const { data: orderData, error: orderError } = await supabase
        .from('order_proposals')
        .insert({
          tenant_id: locationData.tenant_id,
          location_id: locationId,
          coffee_variety: selectedItems.map(item => item.variety_name).join(", "),
          delivery_type: formData.delivery_type,
          notes: formData.notes,
          items: selectedItems.map(item => ({
            variety: item.variety_name,
            quantity: item.quantity_kg,
            unit: "kg"
          })),
          created_by: null,
          source: 'manual'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create the detailed order items
      const orderItems = selectedItems.map(item => ({
        order_proposal_id: orderData.id,
        coffee_variety_id: item.coffee_variety_id,
        quantity_kg: item.quantity_kg,
        unit_price: item.price_per_kg,
        notes: item.notes
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast({
        title: "Pedido enviado",
        description: "Tu solicitud de reposición ha sido enviada correctamente"
      });

      // Reset form
      setSelectedItems([]);
      setFormData({
        delivery_type: "standard", 
        notes: "",
      });

      // Reload orders
      await loadOrders();
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast({
        title: "Error",
        description: error.message || "Error al enviar el pedido",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAiRecommendation = async () => {
    if (!locationId) {
      toast({
        title: "Error",
        description: "Selecciona una ubicación",
        variant: "destructive"
      });
      return;
    }

    if (!aiOrdersEnabled) {
      toast({
        title: "IA no disponible",
        description: "Las recomendaciones de IA están deshabilitadas",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const { data: locationData } = await supabase
        .from('locations')
        .select('tenant_id')
        .eq('id', locationId)
        .single();

      if (!locationData) {
        throw new Error('No se pudo obtener información de la ubicación');
      }

      const { error } = await supabase
        .from('order_proposals')
        .insert({
          tenant_id: locationData.tenant_id,
          location_id: locationId,
          coffee_variety: aiRecommendation.product,
          delivery_type: "standard",
          notes: `Recomendación IA: ${aiRecommendation.reason}`,
          items: [{ variety: aiRecommendation.product, quantity: aiRecommendation.quantity, unit: "kg" }],
          created_by: null,
          source: 'ai'
        });

      if (error) throw error;

      toast({
        title: "Recomendación aplicada",
        description: "El pedido basado en IA ha sido creado exitosamente"
      });

      await loadOrders();
    } catch (error: any) {
      console.error('Error applying AI recommendation:', error);
      toast({
        title: "Error",
        description: error.message || "Error al aplicar la recomendación",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      pending: "outline",
      approved: "default",
      rejected: "destructive",
      fulfilled: "secondary"
    };

    const labels: Record<string, string> = {
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <Package className="mr-3 h-8 w-8" />
              Reposición de Café
            </h1>
            <p className="text-muted-foreground">
              {location ? `Gestiona el stock y pedidos de café para ${location}` : "Gestiona el stock y pedidos de café para tu ubicación"}
            </p>
          </div>
          <LocationSwitcher />
        </div>

        {locationId ? (
          <>
            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Manual Order Form - 2 columns */}
              <div className="lg:col-span-2">
                <Tabs defaultValue="manual" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="manual" className="flex items-center">
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Pedido Manual
                    </TabsTrigger>
                    <TabsTrigger value="bulk" className="flex items-center">
                      <Package className="mr-2 h-4 w-4" />
                      Pedido Masivo
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="manual">
                    <Card>
                      <CardHeader>
                        <CardTitle>Crear Pedido Manual</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                           {/* Enhanced Coffee Selection V2 */}
                           <div>
                             <Label>Sistema de Reposición Mejorado</Label>
                             <div className="mt-2">
                               <EnhancedCoffeeSelectorV2
                                 locationId={locationId}
                                 selectedGroundItems={selectedGroundItems}
                                 selectedProductItems={selectedProductItems}
                                 onGroundItemsChange={setSelectedGroundItems}
                                 onProductItemsChange={setSelectedProductItems}
                               />
                             </div>
                           </div>

                          <Separator />

                          {/* Delivery Options */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="delivery_type">Tipo de Entrega</Label>
                              <Select 
                                value={formData.delivery_type} 
                                onValueChange={(value) => setFormData({...formData, delivery_type: value})}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="standard">
                                    <div className="flex items-center">
                                      <Truck className="mr-2 h-4 w-4" />
                                      Estándar (3-5 días)
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="express">
                                    <div className="flex items-center">
                                      <Clock className="mr-2 h-4 w-4" />
                                      Express (1-2 días)
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="scheduled">
                                    <div className="flex items-center">
                                      <Calendar className="mr-2 h-4 w-4" />
                                      Programada
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Notes */}
                          <div>
                            <Label htmlFor="notes">Observaciones</Label>
                            <Textarea
                              id="notes"
                              placeholder="Notas adicionales para el pedido..."
                              value={formData.notes}
                              onChange={(e) => setFormData({...formData, notes: e.target.value})}
                              className="min-h-[80px]"
                            />
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                            <Button 
                              onClick={handleSubmitOrder}
                              disabled={loading || selectedItems.length === 0}
                              className="flex-1"
                            >
                              {loading ? "Enviando..." : "Enviar Pedido"}
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => {
                                setSelectedItems([]);
                                setFormData({ delivery_type: "standard", notes: "" });
                              }}
                            >
                              Limpiar
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="bulk">
                    <Card>
                      <CardHeader>
                        <CardTitle>Pedido Masivo</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-8 text-muted-foreground">
                          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Función de pedido masivo próximamente...</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>

              {/* AI Recommendation Panel - 1 column */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Bot className="mr-2 h-5 w-5" />
                      Recomendación IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {aiOrdersEnabled ? (
                      <>
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="font-medium">{aiRecommendation.product}</div>
                          <div className="text-2xl font-bold text-primary mt-1">
                            {aiRecommendation.quantity} kg
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Stock actual: {aiRecommendation.currentStock}
                          </div>
                        </div>
                        
                        <div className="text-sm text-muted-foreground">
                          {aiRecommendation.reason}
                        </div>
                        
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            Recomendamos reponer este producto en los próximos días para evitar desabastecimiento.
                          </AlertDescription>
                        </Alert>

                        <Button 
                          onClick={handleApplyAiRecommendation} 
                          className="w-full"
                          disabled={loading}
                        >
                          Aplicar Recomendación
                        </Button>
                      </>
                    ) : (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Las recomendaciones de IA no están disponibles en este momento.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <TrendingUp className="mr-2 h-5 w-5" />
                      Resumen
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Pedidos este mes</span>
                      <Badge variant="outline">{orders.length}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Stock crítico</span>
                      <Badge variant="destructive">2 productos</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Próxima entrega</span>
                      <Badge variant="secondary">Mañana</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Order History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  Historial de Pedidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay pedidos registrados para esta ubicación</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Fuente</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Entrega</TableHead>
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
                            {order.coffee_variety || "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={order.source === "ai" ? "default" : "secondary"}>
                              {order.source === "ai" ? "IA" : "Manual"}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell>
                            {order.delivery_type || "Estándar"}
                          </TableCell>
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
          </>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Coffee className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Selecciona una ubicación</h3>
              <p className="text-muted-foreground">
                Para comenzar a gestionar la reposición de café, selecciona una ubicación desde el selector superior.
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}