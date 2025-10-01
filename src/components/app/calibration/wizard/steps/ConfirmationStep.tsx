import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronLeft, CheckCircle, AlertTriangle, Sparkles } from "lucide-react";
import { useCoffeeProfiles } from "@/hooks/useCoffeeProfiles";
import { useCalibrationSettings } from "@/hooks/useCalibrationSettings";
import { useProfile } from "@/hooks/useProfile";
import { useCreateCalibrationEntry, useApproveCalibrationEntry } from "@/hooks/useCalibrationEntries";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { calculateRatio, validateCalibration, evaluateSemaphore, calculateClicksDelta } from "@/lib/calibration-utils";
import { WizardState } from "../CalibrationWizard";
import { useToast } from "@/hooks/use-toast";

interface ConfirmationStepProps {
  state: WizardState;
  locationId?: string;
  onPrevious: () => void;
  onComplete: () => void;
  sessionRef: React.MutableRefObject<any>;
}

export function ConfirmationStep({
  state,
  locationId,
  onPrevious,
  onComplete,
  sessionRef,
}: ConfirmationStepProps) {
  const { profile } = useProfile();
  const { data: coffeeProfiles = [] } = useCoffeeProfiles(locationId);
  const { data: settings } = useCalibrationSettings();
  const { isOnline, addToQueue } = useOfflineSync();
  const createEntry = useCreateCalibrationEntry();
  const approveEntry = useApproveCalibrationEntry();
  const { toast } = useToast();

  const selectedProfile = useMemo(
    () => coffeeProfiles.find((p) => p.id === state.selectedProfileId),
    [coffeeProfiles, state.selectedProfileId]
  );

  const ratio = useMemo(() => {
    const density = settings?.density_conversion || 0.98;
    return calculateRatio(state.yieldValue, state.yieldUnit, state.doseG, density);
  }, [state.doseG, state.yieldValue, state.yieldUnit, settings]);

  const validation = useMemo(() => {
    const maxGrindDelta = settings?.max_grind_delta || 1.5;
    const grindDelta = state.previousGrindPoints !== undefined ? state.grindPoints - state.previousGrindPoints : 0;
    return validateCalibration(state.doseG, state.yieldValue, state.timeS, grindDelta, maxGrindDelta);
  }, [state, settings]);

  const semaphore = useMemo(() => {
    if (!selectedProfile) return null;
    return evaluateSemaphore({
      timeS: state.timeS,
      ratio,
      targetTimeMin: selectedProfile.target_time_min,
      targetTimeMax: selectedProfile.target_time_max,
      targetRatioMin: selectedProfile.target_ratio_min,
      targetRatioMax: selectedProfile.target_ratio_max,
    });
  }, [selectedProfile, state.timeS, ratio]);

  const clicksDelta = useMemo(() => {
    const grinder = selectedProfile?.grinders;
    const clicksPerPoint =
      grinder && typeof grinder === "object" && "clicks_per_point" in grinder
        ? (grinder as any).clicks_per_point
        : 1;
    return calculateClicksDelta(state.grindPoints, state.previousGrindPoints, clicksPerPoint);
  }, [state.grindPoints, state.previousGrindPoints, selectedProfile]);

  const handleSaveAndApprove = async () => {
    if (!profile?.id) return;

    const entryData = {
      coffee_profile_id: state.selectedProfileId,
      barista_id: profile.id,
      turno: state.turno,
      dose_g: state.doseG,
      yield_value: state.yieldValue,
      yield_unit: state.yieldUnit,
      time_s: state.timeS,
      temp_c: state.tempC,
      grind_points: state.grindPoints,
      grind_label: state.grindLabel || null,
      grinder_clicks_delta: clicksDelta,
      notes_tags: state.notesTags,
      notes_text: state.notesText || null,
      suggestion_shown: "",
    };

    try {
      if (isOnline) {
        const result = await createEntry.mutateAsync(entryData);
        await approveEntry.mutateAsync(result.id);

        toast({
          title: "¡Calibración aprobada!",
          description: "La calibración se guardó y aprobó exitosamente.",
        });
      } else {
        toast({
          title: "Guardado offline",
          description: "Se sincronizará cuando recuperes conexión.",
        });
      }

      onComplete();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar la calibración. Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  const getSemaphoreColor = () => {
    if (!semaphore) return "bg-muted";
    switch (semaphore.overallStatus) {
      case "good":
        return "bg-green-500";
      case "warning":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-muted";
    }
  };

  const getSemaphoreEmoji = () => {
    if (!semaphore) return "😐";
    switch (semaphore.overallStatus) {
      case "good":
        return "😊";
      case "warning":
        return "😐";
      case "error":
        return "😟";
      default:
        return "😐";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold mb-2">Confirmar Calibración</h2>
        <p className="text-muted-foreground">
          Revisa todos los valores antes de aprobar.
        </p>
      </div>

      {/* Validation Messages */}
      {validation.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {validation.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {validation.warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {validation.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Semaphore Status */}
      <Card className="p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className={`w-20 h-20 rounded-full ${getSemaphoreColor()} flex items-center justify-center text-4xl shadow-lg`}>
            {getSemaphoreEmoji()}
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Estado General</div>
            <div className="text-xl font-bold capitalize">
              {semaphore?.overallStatus === "good" && "Excelente"}
              {semaphore?.overallStatus === "warning" && "Aceptable"}
              {semaphore?.overallStatus === "error" && "Necesita ajustes"}
            </div>
          </div>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Café</span>
            <span className="font-semibold">{selectedProfile?.name}</span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Turno</span>
            <Badge className="capitalize">{state.turno}</Badge>
          </div>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Dosis</span>
            <span className="font-semibold">{state.doseG.toFixed(1)}g</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Rendimiento</span>
            <span className="font-semibold">{state.yieldValue}{state.yieldUnit}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Ratio</span>
            <span className="font-semibold">{ratio.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tiempo</span>
            <span className="font-semibold">{state.timeS}s</span>
          </div>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Temperatura</span>
            <span className="font-semibold">{state.tempC}°C</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Molienda</span>
            <span className="font-semibold">{state.grindPoints.toFixed(1)}</span>
          </div>
        </Card>

        {state.notesTags.length > 0 && (
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-2">Notas</div>
            <div className="flex flex-wrap gap-2">
              {state.notesTags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onPrevious} className="flex-1 h-12">
          <ChevronLeft className="w-5 h-5 mr-2" />
          Anterior
        </Button>
        <Button
          onClick={handleSaveAndApprove}
          disabled={!validation.isValid || createEntry.isPending || approveEntry.isPending}
          className="flex-1 h-12 bg-gradient-to-r from-primary to-primary/80"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          {createEntry.isPending || approveEntry.isPending ? "Guardando..." : "Aprobar Calibración"}
        </Button>
      </div>
    </div>
  );
}
