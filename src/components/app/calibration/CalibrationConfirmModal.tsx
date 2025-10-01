import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ArrowRight } from "lucide-react";

interface CalibrationConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  currentParams: {
    doseG: number;
    yieldValue: number;
    timeS: number;
    tempC: number;
    grindPoints: number;
  };
  previousParams?: {
    dose_g: number;
    yield_value: number;
    time_s: number;
    temp_c: number;
    grind_points: number;
  };
  drasticChanges: string[];
  isReplacement: boolean;
}

export function CalibrationConfirmModal({
  open,
  onOpenChange,
  onConfirm,
  currentParams,
  previousParams,
  drasticChanges,
  isReplacement,
}: CalibrationConfirmModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isReplacement ? "¿Reemplazar Calibración Aprobada?" : "¿Aprobar Calibración?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isReplacement 
              ? "Estás a punto de reemplazar la calibración aprobada actual con nuevos parámetros."
              : "Estás a punto de aprobar esta calibración para el turno actual."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Drastic Changes Warning */}
          {drasticChanges.length > 0 && (
            <Alert variant="default" className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <p className="font-semibold mb-1">Se detectaron cambios significativos:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {drasticChanges.map((change, idx) => (
                    <li key={idx}>{change}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Comparison Table */}
          {previousParams && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Parámetro</th>
                    <th className="px-4 py-2 text-center font-medium">Anterior</th>
                    <th className="px-4 py-2 text-center w-12"></th>
                    <th className="px-4 py-2 text-center font-medium">Nueva</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="px-4 py-2">Dosis</td>
                    <td className="px-4 py-2 text-center">{previousParams.dose_g.toFixed(1)}g</td>
                    <td className="px-4 py-2 text-center">
                      <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground" />
                    </td>
                    <td className="px-4 py-2 text-center font-semibold">{currentParams.doseG.toFixed(1)}g</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Rendimiento</td>
                    <td className="px-4 py-2 text-center">{previousParams.yield_value.toFixed(1)}g</td>
                    <td className="px-4 py-2 text-center">
                      <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground" />
                    </td>
                    <td className="px-4 py-2 text-center font-semibold">{currentParams.yieldValue.toFixed(1)}g</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Tiempo</td>
                    <td className="px-4 py-2 text-center">{previousParams.time_s.toFixed(1)}s</td>
                    <td className="px-4 py-2 text-center">
                      <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground" />
                    </td>
                    <td className="px-4 py-2 text-center font-semibold">{currentParams.timeS.toFixed(1)}s</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Temperatura</td>
                    <td className="px-4 py-2 text-center">{previousParams.temp_c.toFixed(1)}°C</td>
                    <td className="px-4 py-2 text-center">
                      <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground" />
                    </td>
                    <td className="px-4 py-2 text-center font-semibold">{currentParams.tempC.toFixed(1)}°C</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Molienda</td>
                    <td className="px-4 py-2 text-center">{previousParams.grind_points.toFixed(1)}</td>
                    <td className="px-4 py-2 text-center">
                      <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground" />
                    </td>
                    <td className="px-4 py-2 text-center font-semibold">{currentParams.grindPoints.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {isReplacement ? "Sí, Reemplazar" : "Sí, Aprobar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
