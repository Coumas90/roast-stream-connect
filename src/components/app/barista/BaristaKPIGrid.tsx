import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, TrendingUp, Zap, Coffee } from "lucide-react";
import { useBaristaMetrics } from "@/hooks/useBaristaMetrics";
import { useProfile } from "@/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function BaristaKPIGrid() {
  const { profile } = useProfile();
  const { data: metrics, isLoading } = useBaristaMetrics(profile?.id);

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  const kpis = [
    {
      title: "Calibraciones Hoy",
      value: metrics?.todayCalibrations || 0,
      icon: Coffee,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Aprobadas Hoy",
      value: metrics?.todayApproved || 0,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Tasa de Éxito",
      value: `${metrics?.successRate || 0}%`,
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Última Calibración",
      value: metrics?.lastCalibrationTime 
        ? formatDistanceToNow(new Date(metrics.lastCalibrationTime), { 
            addSuffix: true, 
            locale: es 
          })
        : "—",
      icon: Zap,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ];

  return (
    <section className="grid gap-6 md:grid-cols-4">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <Card 
            key={kpi.title} 
            className="hover-lift shadow-soft border-0 bg-gradient-card animate-scale-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                <Icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
