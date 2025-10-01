import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  RotateCcw, 
  TrendingUp, 
  Activity,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { getCalibrationTelemetry } from "@/lib/telemetry";

interface TelemetryDashboardProps {
  locationId: string;
  days?: number;
}

export function TelemetryDashboard({ locationId, days = 30 }: TelemetryDashboardProps) {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTelemetry();
  }, [locationId, days]);

  const loadTelemetry = async () => {
    setIsLoading(true);
    const data = await getCalibrationTelemetry(locationId, days);
    setTelemetry(data);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          Cargando métricas...
        </div>
      </Card>
    );
  }

  if (!telemetry) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          No hay datos de telemetría disponibles
        </div>
      </Card>
    );
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Métricas de Calibración</h3>
        <Badge variant="outline">Últimos {days} días</Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Average Time to Approval */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-muted-foreground">Tiempo Promedio</span>
          </div>
          <div className="text-2xl font-bold">
            {formatTime(telemetry.avg_time_to_approval)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Hasta aprobación
          </p>
        </Card>

        {/* Success Rate */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-xs text-muted-foreground">Tasa de Éxito</span>
          </div>
          <div className="text-2xl font-bold">
            {telemetry.success_rate}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Aprobadas al primer intento
          </p>
        </Card>

        {/* Total Reversions */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw className="h-4 w-4 text-amber-600" />
            <span className="text-xs text-muted-foreground">Reversiones</span>
          </div>
          <div className="text-2xl font-bold">
            {telemetry.total_reversions}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total de ajustes
          </p>
        </Card>

        {/* Total Events */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-purple-600" />
            <span className="text-xs text-muted-foreground">Actividad</span>
          </div>
          <div className="text-2xl font-bold">
            {telemetry.total_events}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Eventos totales
          </p>
        </Card>
      </div>

      {/* Event Breakdown */}
      <Card className="p-4">
        <h4 className="text-sm font-semibold mb-3">Desglose de Eventos</h4>
        <div className="space-y-2">
          {Object.entries(telemetry.by_type).map(([type, count]) => (
            <div key={type} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground capitalize">
                {type.replace('calibration_', '').replace('_', ' ')}
              </span>
              <Badge variant="secondary">{count as number}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Performance Indicator */}
      <Card className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <div className="flex items-start gap-3">
          <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-green-900 mb-1">
              Rendimiento
            </h4>
            <p className="text-xs text-green-800">
              {telemetry.success_rate >= 80 ? (
                "Excelente consistencia en las calibraciones. Continúa con el buen trabajo."
              ) : telemetry.success_rate >= 60 ? (
                "Buen desempeño. Considera revisar las guías de calibración para mejorar."
              ) : (
                "Hay oportunidad de mejora. Revisa la guía de calibración y solicita capacitación si es necesario."
              )}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
