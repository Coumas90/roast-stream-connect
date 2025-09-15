import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, TrendingDown, Coffee } from "lucide-react";
import { useStockMetrics } from "@/hooks/useLocationStock";
import { useConsumptionMetrics } from "@/hooks/useConsumptionMetrics";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface StockAlertsProps {
  locationId?: string;
}

export function StockAlerts({ locationId }: StockAlertsProps) {
  const { lowStockItems, totalStock, lastRefillDate } = useStockMetrics(locationId);
  const { estimatedCoffeeKg, dailyAverage } = useConsumptionMetrics(locationId);

  // Calculate estimated days until restock needed
  const estimatedDaysLeft = dailyAverage > 0 ? Math.round((totalStock * 67) / dailyAverage) : null;

  const alerts = [];

  // Critical stock alerts
  if (lowStockItems.length > 0) {
    alerts.push({
      id: 'low-stock',
      type: 'critical' as const,
      title: 'Stock Crítico',
      description: `${lowStockItems.length} café(s) con menos de 5kg disponibles`,
      action: 'Hacer Pedido Ahora',
      actionHref: '/app/replenishment',
      icon: AlertTriangle
    });
  }

  // Estimated restock timing
  if (estimatedDaysLeft !== null && estimatedDaysLeft <= 7) {
    alerts.push({
      id: 'restock-soon',
      type: 'warning' as const,
      title: 'Reposición Próxima',
      description: `Stock estimado para ${estimatedDaysLeft} días más`,
      action: 'Planificar Pedido',
      actionHref: '/app/replenishment',
      icon: Clock
    });
  }

  // No recent refills
  if (lastRefillDate && new Date().getTime() - lastRefillDate.getTime() > 14 * 24 * 60 * 60 * 1000) {
    alerts.push({
      id: 'no-recent-refill',
      type: 'info' as const,
      title: 'Sin Reposiciones Recientes',
      description: `Última reposición: ${formatDistanceToNow(lastRefillDate, { addSuffix: true, locale: es })}`,
      action: 'Ver Historial',
      actionHref: '/app/replenishment',
      icon: TrendingDown
    });
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coffee className="h-5 w-5" />
            Estado del Stock
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
              <Coffee className="h-6 w-6 text-success" />
            </div>
            <h3 className="font-medium text-success mb-1">Todo en Orden</h3>
            <p className="text-sm text-muted-foreground">
              Tu stock está en niveles óptimos
            </p>
            {estimatedDaysLeft && (
              <Badge variant="outline" className="mt-2">
                ~{estimatedDaysLeft} días de cobertura
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Alertas de Stock
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.map((alert) => {
          const Icon = alert.icon;
          const variant = alert.type === 'critical' ? 'destructive' : 
                        alert.type === 'warning' ? 'default' : 'default';
          
          return (
            <Alert key={alert.id} className={
              alert.type === 'critical' ? 'border-destructive/50 bg-destructive/5' :
              alert.type === 'warning' ? 'border-warning/50 bg-warning/5' :
              'border-primary/50 bg-primary/5'
            }>
              <Icon className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium mb-1">{alert.title}</div>
                    <div className="text-sm">{alert.description}</div>
                  </div>
                  <Button size="sm" variant={variant} asChild>
                    <a href={alert.actionHref}>
                      {alert.action}
                    </a>
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          );
        })}
      </CardContent>
    </Card>
  );
}