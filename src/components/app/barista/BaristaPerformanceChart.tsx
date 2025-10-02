import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type DailyPerformance = {
  date: string;
  successRate: number;
  total: number;
  approved: number;
};

export function BaristaPerformanceChart() {
  const { profile } = useProfile();

  const { data: performanceData, isLoading } = useQuery({
    queryKey: ['barista-performance', profile?.id],
    queryFn: async (): Promise<DailyPerformance[]> => {
      if (!profile?.id) return [];

      const days = 7;
      const results: DailyPerformance[] = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);

        const { data, error } = await supabase
          .from('calibration_entries')
          .select('approved')
          .eq('barista_id', profile.id)
          .gte('fecha', dayStart.toISOString())
          .lte('fecha', dayEnd.toISOString());

        if (error) throw error;

        const total = data?.length || 0;
        const approved = data?.filter(c => c.approved).length || 0;
        const successRate = total > 0 ? Math.round((approved / total) * 100) : 0;

        results.push({
          date: format(date, 'EEE', { locale: es }),
          successRate,
          total,
          approved,
        });
      }

      return results;
    },
    enabled: !!profile?.id,
  });

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <Card className="shadow-elegant border-0 bg-gradient-card">
      <CardHeader className="border-b border-border/50">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          Desempeño Semanal
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {performanceData && performanceData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                domain={[0, 100]}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                label={{ 
                  value: '% Aprobadas', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fill: 'hsl(var(--muted-foreground))' }
                }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number, name: string, props: any) => [
                  `${value}% (${props.payload.approved}/${props.payload.total})`,
                  'Tasa de Éxito'
                ]}
              />
              <Line 
                type="monotone" 
                dataKey="successRate" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No hay datos suficientes para mostrar
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
