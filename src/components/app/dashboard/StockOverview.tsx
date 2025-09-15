import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Coffee, AlertTriangle, TrendingUp } from "lucide-react";
import { useStockMetrics } from "@/hooks/useLocationStock";

interface StockOverviewProps {
  locationId?: string;
}

export function StockOverview({ locationId }: StockOverviewProps) {
  const { stockItems, totalStock, lowStockItems, isLoading } = useStockMetrics(locationId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coffee className="h-5 w-5" />
            Stock por Café
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-2 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coffee className="h-5 w-5" />
          Stock por Café
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stockItems.length === 0 ? (
          <div className="text-center py-6">
            <Coffee className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No hay stock configurado</p>
          </div>
        ) : (
          stockItems.map((item) => {
            const maxCapacity = 25; // Assuming 25kg max per hopper
            const percentage = (item.current_kg / maxCapacity) * 100;
            const isLow = item.current_kg < 5;
            
            return (
              <div key={item.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.coffee_varieties.name}</span>
                    {isLow && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Bajo
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {item.current_kg}kg / {maxCapacity}kg
                  </div>
                </div>
                <Progress 
                  value={percentage} 
                  className="h-2"
                  style={{
                    background: `hsl(var(--muted))`,
                  }}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Tolva #{item.hopper_number}</span>
                  <span>{Math.round(percentage)}% lleno</span>
                </div>
              </div>
            );
          })
        )}
        
        {lowStockItems.length > 0 && (
          <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <div className="flex items-center gap-2 text-warning-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {lowStockItems.length} café(s) con stock bajo
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}