import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRecentCalibrations } from "@/hooks/useRecentCalibrations";
import { useProfile } from "@/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function CoffeeEvolutionChart() {
  const { profile } = useProfile();
  const { data: calibrations, isLoading } = useRecentCalibrations(profile?.id, 20);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">📈</span>
            Evolución del Café
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Filtrar solo aprobadas de hoy
  const today = new Date().toISOString().split('T')[0];
  const todayCals = calibrations?.filter(c => 
    c.approved && c.fecha === today
  ) || [];

  if (todayCals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">📈</span>
            Evolución del Café
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <span className="text-4xl mb-2">📊</span>
            <p className="text-sm">No hay calibraciones aprobadas hoy</p>
            <p className="text-xs">El gráfico aparecerá cuando tengas calibraciones aprobadas</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Preparar datos para el gráfico
  const chartData = todayCals.reverse().map(cal => {
    const time = new Date(cal.created_at);
    return {
      time: format(time, 'HH:mm', { locale: es }),
      ratio: cal.ratio_calc || 0,
      tiempo: cal.time_s,
      timestamp: time.getTime(),
    };
  });

  // Calcular rangos target (aproximados de la primera calibración)
  const targetRatioMin = 1.8;
  const targetRatioMax = 2.2;
  const targetTimeMin = 25;
  const targetTimeMax = 32;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">📈</span>
          Evolución del Café Hoy
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {todayCals.length} calibraciones aprobadas
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="time" 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              yAxisId="left"
              label={{ value: 'Ratio', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right"
              label={{ value: 'Tiempo (s)', angle: 90, position: 'insideRight', fill: 'hsl(var(--muted-foreground))' }}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend />
            
            {/* Zonas target */}
            <ReferenceLine y={targetRatioMin} yAxisId="left" stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
            <ReferenceLine y={targetRatioMax} yAxisId="left" stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
            
            {/* Líneas principales */}
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="ratio" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              name="Ratio"
              dot={{ fill: 'hsl(var(--primary))', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="tiempo" 
              stroke="hsl(var(--chart-2))" 
              strokeWidth={2}
              name="Tiempo (s)"
              dot={{ fill: 'hsl(var(--chart-2))', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Leyenda de rangos */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-primary"></div>
            <span>Ratio target: {targetRatioMin} - {targetRatioMax}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-chart-2"></div>
            <span>Tiempo target: {targetTimeMin}s - {targetTimeMax}s</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
