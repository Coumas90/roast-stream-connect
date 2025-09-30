import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Calendar, Package, Settings } from 'lucide-react';
import { EnhancedCoffeeSelectorV2, GroundCoffeeOrderItem, ProductOrderItem } from './EnhancedCoffeeSelectorV2';
import { useUpdateRecurringOrder, RecurringOrder } from '@/hooks/useRecurringOrders';
import { addDays, format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

interface AutoOrderConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationId: string;
  tenantId: string;
  existingOrder?: RecurringOrder | null;
}

export function AutoOrderConfigModal({ 
  isOpen, 
  onClose, 
  locationId, 
  tenantId, 
  existingOrder 
}: AutoOrderConfigModalProps) {
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [dayOfWeek, setDayOfWeek] = useState<number>(1); // Monday
  const [deliveryType, setDeliveryType] = useState('standard');
  const [notes, setNotes] = useState('');
  const [selectedGroundItems, setSelectedGroundItems] = useState<GroundCoffeeOrderItem[]>([]);
  const [selectedProductItems, setSelectedProductItems] = useState<ProductOrderItem[]>([]);

  const updateMutation = useUpdateRecurringOrder();

  // Load existing configuration
  useEffect(() => {
    if (existingOrder) {
      setFrequency(existingOrder.frequency);
      setDayOfWeek(existingOrder.day_of_week || 1);
      setDeliveryType(existingOrder.delivery_type || 'standard');
      setNotes(existingOrder.notes || '');
      
      // Convert items back to selector format
      const groundItems: GroundCoffeeOrderItem[] = [];
      const productItems: ProductOrderItem[] = [];
      
      existingOrder.items.forEach(item => {
        if (item.type === 'ground') {
          groundItems.push({
            coffee_variety_id: '', // Will need to be resolved
            variety_name: item.variety,
            category: 'other',
            quantity_kg: item.quantity,
            price_per_kg: 0,
            notes: ''
          });
        } else {
          productItems.push({
            coffee_product_id: '', // Will need to be resolved
            product_name: item.variety,
            quantity_units: item.quantity,
            weight_grams: 250,
            product_type: 'package',
            price_per_unit: 0,
            sku: ''
          });
        }
      });
      
      setSelectedGroundItems(groundItems);
      setSelectedProductItems(productItems);
    }
  }, [existingOrder]);

  const calculateNextOrderDate = (freq: string, day: number) => {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const targetDay = day === 7 ? 0 : day; // Convert Sunday from 7 to 0
    
    let daysUntilNext = targetDay - currentDayOfWeek;
    if (daysUntilNext <= 0) {
      daysUntilNext += 7; // Next week
    }
    
    const nextDate = addDays(today, daysUntilNext);
    
    // Adjust for frequency
    if (freq === 'biweekly') {
      return addDays(nextDate, 7); // Add another week
    } else if (freq === 'monthly') {
      return addDays(nextDate, 21); // Add 3 more weeks (approximately monthly)
    }
    
    return nextDate;
  };

  const handleSave = async () => {
    if (selectedGroundItems.length === 0 && selectedProductItems.length === 0) {
      return; // Should show error
    }

    const items = [
      ...selectedGroundItems.map(item => ({
        variety: item.variety_name,
        quantity: item.quantity_kg,
        unit: 'kg',
        type: 'ground' as const
      })),
      ...selectedProductItems.map(item => ({
        variety: item.product_name,
        quantity: item.quantity_units,
        unit: 'units',
        type: 'product' as const
      }))
    ];

    const nextOrderDate = calculateNextOrderDate(frequency, dayOfWeek);

    const orderData = {
      location_id: locationId,
      tenant_id: tenantId,
      enabled: true,
      frequency,
      day_of_week: dayOfWeek,
      items,
      delivery_type: deliveryType,
      notes: notes.trim() || null,
      next_order_date: format(nextOrderDate, 'yyyy-MM-dd'),
      ...(existingOrder && { id: existingOrder.id })
    };

    updateMutation.mutate(orderData, {
      onSuccess: () => {
        onClose();
      }
    });
  };

  const getDayOptions = () => [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 7, label: 'Domingo' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            {existingOrder ? 'Editar Pedidos Automáticos' : 'Configurar Pedidos Automáticos'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="schedule" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="schedule" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Programación
              </TabsTrigger>
              <TabsTrigger value="products" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Productos
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Detalles
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4">
              <TabsContent value="schedule" className="space-y-4 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Configuración de Horarios</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="frequency">Frecuencia</Label>
                      <Select value={frequency} onValueChange={(value: any) => setFrequency(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="biweekly">Quincenal</SelectItem>
                          <SelectItem value="monthly">Mensual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {frequency === 'weekly' && (
                      <div>
                        <Label htmlFor="dayOfWeek">Día de la semana</Label>
                        <Select value={dayOfWeek.toString()} onValueChange={(value) => setDayOfWeek(Number(value))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getDayOptions().map(day => (
                              <SelectItem key={day.value} value={day.value.toString()}>
                                {day.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">Vista previa del próximo pedido:</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(calculateNextOrderDate(frequency, dayOfWeek), 'EEEE, dd/MM/yyyy', { locale: es })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="products" className="mt-0 h-full">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-lg">Seleccionar Productos</CardTitle>
                  </CardHeader>
                  <CardContent className="h-full">
                    <EnhancedCoffeeSelectorV2
                      locationId={locationId}
                      selectedGroundItems={selectedGroundItems}
                      selectedProductItems={selectedProductItems}
                      onGroundItemsChange={setSelectedGroundItems}
                      onProductItemsChange={setSelectedProductItems}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="details" className="space-y-4 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Opciones de Entrega</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="deliveryType">Tipo de entrega</Label>
                      <Select value={deliveryType} onValueChange={setDeliveryType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Estándar</SelectItem>
                          <SelectItem value="express">Express</SelectItem>
                          <SelectItem value="scheduled">Programada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="notes">Notas adicionales</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Instrucciones especiales para la entrega..."
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateMutation.isPending || (selectedGroundItems.length === 0 && selectedProductItems.length === 0)}
          >
            <Save className="mr-2 h-4 w-4" />
            {updateMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}