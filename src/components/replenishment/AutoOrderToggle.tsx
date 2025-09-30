import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Settings, Clock, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { useRecurringOrders, useToggleRecurringOrder } from '@/hooks/useRecurringOrders';
import { AutoOrderConfigModal } from './AutoOrderConfigModal';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface AutoOrderToggleProps {
  locationId: string;
  tenantId: string;
}

export function AutoOrderToggle({ locationId, tenantId }: AutoOrderToggleProps) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const { data: recurringOrder, isLoading } = useRecurringOrders(locationId);
  const toggleMutation = useToggleRecurringOrder();

  const handleToggle = async (enabled: boolean) => {
    if (!recurringOrder) {
      setIsConfigOpen(true);
      return;
    }
    
    toggleMutation.mutate({ id: recurringOrder.id, enabled });
  };

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'weekly': return 'Semanal';
      case 'biweekly': return 'Quincenal';
      case 'monthly': return 'Mensual';
      default: return frequency;
    }
  };

  const getDayLabel = (dayOfWeek: number) => {
    const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return days[dayOfWeek] || '';
  };

  const getNextOrderDate = () => {
    if (!recurringOrder?.next_order_date) return null;
    try {
      return format(new Date(recurringOrder.next_order_date), 'dd/MM/yyyy', { locale: es });
    } catch {
      return null;
    }
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/3"></div>
        </CardHeader>
        <CardContent>
          <div className="h-4 bg-muted rounded w-2/3"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="hover-lift transition-all duration-300">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-lg">
              <Clock className="mr-2 h-5 w-5 text-primary" />
              Pedidos Automáticos
            </CardTitle>
            <div className="flex items-center gap-3">
              {recurringOrder?.enabled && (
                <Badge variant="default" className="bg-success text-success-foreground">
                  Activo
                </Badge>
              )}
              <Switch
                checked={recurringOrder?.enabled || false}
                onCheckedChange={handleToggle}
                disabled={toggleMutation.isPending}
              />
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {!recurringOrder ? (
            <div className="text-center py-4">
              <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground text-sm">
                Configura pedidos automáticos para ahorrar tiempo
              </p>
              <Button 
                onClick={() => setIsConfigOpen(true)}
                variant="outline" 
                size="sm"
                className="mt-2"
              >
                <Settings className="mr-2 h-4 w-4" />
                Configurar
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Frecuencia:</span>
                  <Badge variant="outline">
                    {getFrequencyLabel(recurringOrder.frequency)}
                    {recurringOrder.day_of_week && ` - ${getDayLabel(recurringOrder.day_of_week)}`}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-6 w-6 p-0"
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>

              {getNextOrderDate() && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Próximo pedido:</span>
                  <span className="font-medium">{getNextOrderDate()}</span>
                </div>
              )}

              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-border space-y-3 animate-fade-in">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Productos configurados:</h4>
                    <div className="space-y-1">
                      {recurringOrder.items.map((item, index) => (
                        <div key={index} className="text-sm text-muted-foreground">
                          • {item.variety}: {item.quantity} {item.unit === 'kg' ? 'kg' : 'unidades'}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {recurringOrder.notes && (
                    <div>
                      <h4 className="font-medium text-sm mb-1">Notas:</h4>
                      <p className="text-sm text-muted-foreground">{recurringOrder.notes}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={() => setIsConfigOpen(true)}
                  variant="outline" 
                  size="sm"
                  className="flex-1"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AutoOrderConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        locationId={locationId}
        tenantId={tenantId}
        existingOrder={recurringOrder}
      />
    </>
  );
}