import { Card } from "@/components/ui/card";
import { TelemetryDashboard } from "@/components/app/calibration/TelemetryDashboard";
import { useProfile } from "@/hooks/useProfile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export function TelemetryTab() {
  const { profile } = useProfile();
  const locationId = profile?.id;

  if (!locationId) {
    return (
      <Card className="p-12 text-center">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            No se pudo cargar la información de telemetría. 
            Por favor, verifica tu perfil.
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Telemetría de Calibración</h2>
        <p className="text-muted-foreground">
          Métricas de desempeño y calidad de las calibraciones realizadas
        </p>
      </div>

      <TelemetryDashboard locationId={locationId} days={30} />

      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          ¿Cómo se calcula la telemetría?
        </h3>
        <ul className="text-xs text-blue-800 space-y-2">
          <li>
            • <strong>Tiempo Promedio:</strong> Desde que se inicia una calibración hasta que se aprueba
          </li>
          <li>
            • <strong>Tasa de Éxito:</strong> Porcentaje de calibraciones aprobadas en el primer intento
          </li>
          <li>
            • <strong>Reversiones:</strong> Número total de veces que se revirtieron cambios
          </li>
          <li>
            • <strong>Actividad:</strong> Total de eventos de calibración registrados
          </li>
        </ul>
      </Card>
    </div>
  );
}
