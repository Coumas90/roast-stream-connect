import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle, Calendar, AlertCircle, TrendingUp } from "lucide-react";
import { TrainingRequest } from "@/hooks/useTrainingRequests";

interface TrainingKPIGridProps {
  requests: TrainingRequest[];
}

export function TrainingKPIGrid({ requests }: TrainingKPIGridProps) {
  const stats = React.useMemo(() => {
    const pending = requests.filter(r => r.status === 'pending').length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const scheduled = requests.filter(r => r.status === 'scheduled').length;
    const completed = requests.filter(r => r.status === 'completed').length;
    const total = requests.length;
    
    // Calculate average response time for completed requests
    const completedRequests = requests.filter(r => r.status === 'completed' && r.completed_at);
    const avgResponseTime = completedRequests.length > 0 
      ? completedRequests.reduce((acc, req) => {
          const created = new Date(req.created_at);
          const completed = new Date(req.completed_at!);
          return acc + (completed.getTime() - created.getTime());
        }, 0) / completedRequests.length / (1000 * 60 * 60 * 24) // Convert to days
      : 0;

    return {
      pending,
      approved,
      scheduled, 
      completed,
      total,
      avgResponseTime: Math.round(avgResponseTime * 10) / 10,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [requests]);

  const kpis = [
    {
      title: "Solicitudes Pendientes",
      value: stats.pending,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: "Aprobadas",
      value: stats.approved,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Programadas",
      value: stats.scheduled,
      icon: Calendar,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Completadas",
      value: stats.completed,
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Tiempo Promedio",
      value: `${stats.avgResponseTime}d`,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Tasa de Completitud",
      value: `${stats.completionRate}%`,
      icon: TrendingUp,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <div className={`p-2 rounded-md ${kpi.bgColor}`}>
                <Icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}