import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { TrendingUp, DollarSign } from "lucide-react";
import { useConsumptionMetrics } from "@/hooks/useConsumptionMetrics";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ConsumptionTrendsProps {
  locationId?: string;
}

export function ConsumptionTrends({ locationId }: ConsumptionTrendsProps) {
  const { consumptionData, monthlyRevenue, dailyAverage, isLoading } = useConsumptionMetrics(locationId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Tendencias de Consumo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] bg-muted animate-pulse rounded"></div>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data from last 7 days of consumption
  const chartData = consumptionData
    ?.slice(0, 7)
    ?.reverse()
    ?.map((item) => ({
      date: format(new Date(item.date), 'dd/MM', { locale: es }),
      ventas: item.total,
      ordenes: item.orders
    })) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Tendencias de Consumo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No hay datos de consumo disponibles</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  ${monthlyRevenue.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Ventas del Mes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  ${Math.round(dailyAverage).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Promedio Diario</div>
              </div>
            </div>
            
            <ChartContainer
              config={{
                ventas: {
                  label: "Ventas ($)",
                  color: "hsl(var(--primary))"
                }
              }}
              className="h-[200px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    formatter={(value: any) => [`$${value.toLocaleString()}`, 'Ventas']}
                  />
                  <Line
                    type="monotone"
                    dataKey="ventas"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}