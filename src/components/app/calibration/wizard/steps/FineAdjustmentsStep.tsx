import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TouchStepper } from "../components/TouchStepper";
import { ParameterCard } from "../components/ParameterCard";
import { useCalibrationSettings } from "@/hooks/useCalibrationSettings";
import { useTodayApprovedEntry } from "@/hooks/useCalibrationEntries";
import { useCoffeeProfiles } from "@/hooks/useCoffeeProfiles";
import { formatGrindDelta, calculateClicksDelta } from "@/lib/calibration-utils";
import { WizardState } from "../CalibrationWizard";

interface FineAdjustmentsStepProps {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  locationId?: string;
  onNext: () => void;
  onPrevious: () => void;
}

export function FineAdjustmentsStep({
  state,
  updateState,
  locationId,
  onNext,
  onPrevious,
}: FineAdjustmentsStepProps) {
  const { data: settings } = useCalibrationSettings();
  const { data: coffeeProfiles = [] } = useCoffeeProfiles(locationId);
  const { data: approvedEntry } = useTodayApprovedEntry(state.selectedProfileId, state.turno);

  const selectedProfile = useMemo(
    () => coffeeProfiles.find((p) => p.id === state.selectedProfileId),
    [coffeeProfiles, state.selectedProfileId]
  );

  const previousGrindPoints = approvedEntry?.grind_points;

  const grindDeltaDisplay = useMemo(() => {
    return formatGrindDelta(state.grindPoints, previousGrindPoints);
  }, [state.grindPoints, previousGrindPoints]);

  const clicksDelta = useMemo(() => {
    const grinder = selectedProfile?.grinders;
    const clicksPerPoint =
      grinder && typeof grinder === "object" && "clicks_per_point" in grinder
        ? (grinder as any).clicks_per_point
        : 1;
    return calculateClicksDelta(state.grindPoints, previousGrindPoints, clicksPerPoint);
  }, [state.grindPoints, previousGrindPoints, selectedProfile]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold mb-2">Ajustes Finos</h2>
        <p className="text-muted-foreground">
          Temperatura y molienda para perfeccionar la extracción.
        </p>
      </div>

      {/* Parameter Cards */}
      <div className="grid gap-4">
        <ParameterCard title="Temperatura" description="Temperatura del agua">
          <TouchStepper
            value={state.tempC}
            onChange={(v) => updateState({ tempC: v })}
            step={settings?.default_steps.temp_c || 0.5}
            min={85}
            max={98}
            unit="°C"
            size="large"
          />
        </ParameterCard>

        <ParameterCard
          title="Molienda"
          description="Ajuste del molino"
          metric={grindDeltaDisplay}
          info={clicksDelta !== 0 ? `~${clicksDelta} clicks` : undefined}
        >
          <TouchStepper
            value={state.grindPoints}
            onChange={(v) => updateState({ grindPoints: v })}
            step={settings?.default_steps.grind_points || 0.1}
            min={0}
            max={10}
            size="large"
          />
        </ParameterCard>

        {/* Optional Grind Label */}
        <div className="space-y-2">
          <Label className="text-sm">Etiqueta de molienda (opcional)</Label>
          <Input
            value={state.grindLabel}
            onChange={(e) => updateState({ grindLabel: e.target.value })}
            placeholder="Ej: A3, Fino 2, etc."
            className="h-12"
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onPrevious} className="flex-1 h-12">
          <ChevronLeft className="w-5 h-5 mr-2" />
          Anterior
        </Button>
        <Button onClick={onNext} className="flex-1 h-12">
          Continuar
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
