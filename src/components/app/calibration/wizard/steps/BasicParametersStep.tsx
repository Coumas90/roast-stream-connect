import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TouchStepper } from "../components/TouchStepper";
import { ParameterCard } from "../components/ParameterCard";
import { SmartSuggestions } from "../components/SmartSuggestions";
import { useCoffeeProfiles } from "@/hooks/useCoffeeProfiles";
import { useCalibrationSettings } from "@/hooks/useCalibrationSettings";
import { useTodayApprovedEntry } from "@/hooks/useCalibrationEntries";
import { useDebounce } from "@/hooks/useDebounce";
import { calculateRatio, evaluateSemaphore } from "@/lib/calibration-utils";
import { WizardState, YieldUnit } from "../CalibrationWizard";

interface BasicParametersStepProps {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  locationId?: string;
  onNext: () => void;
  onPrevious: () => void;
  canNavigateNext: boolean;
}

export function BasicParametersStep({
  state,
  updateState,
  locationId,
  onNext,
  onPrevious,
  canNavigateNext,
}: BasicParametersStepProps) {
  const { data: coffeeProfiles = [] } = useCoffeeProfiles(locationId);
  const { data: settings } = useCalibrationSettings();
  const { data: approvedEntry } = useTodayApprovedEntry(state.selectedProfileId, state.turno);

  const debouncedDoseG = useDebounce(state.doseG, 200);
  const debouncedYieldValue = useDebounce(state.yieldValue, 200);
  const debouncedTimeS = useDebounce(state.timeS, 200);

  const selectedProfile = useMemo(
    () => coffeeProfiles.find((p) => p.id === state.selectedProfileId),
    [coffeeProfiles, state.selectedProfileId]
  );

  const ratio = useMemo(() => {
    const density = settings?.density_conversion || 0.98;
    return calculateRatio(debouncedYieldValue, state.yieldUnit, debouncedDoseG, density);
  }, [debouncedDoseG, debouncedYieldValue, state.yieldUnit, settings]);

  const semaphore = useMemo(() => {
    if (!selectedProfile) return null;

    return evaluateSemaphore({
      timeS: debouncedTimeS,
      ratio,
      targetTimeMin: selectedProfile.target_time_min,
      targetTimeMax: selectedProfile.target_time_max,
      targetRatioMin: selectedProfile.target_ratio_min,
      targetRatioMax: selectedProfile.target_ratio_max,
    });
  }, [selectedProfile, debouncedTimeS, ratio]);

  const handleUseLastCalibration = () => {
    if (approvedEntry) {
      updateState({
        doseG: approvedEntry.dose_g,
        yieldValue: approvedEntry.yield_value,
        yieldUnit: approvedEntry.yield_unit as YieldUnit,
        timeS: approvedEntry.time_s,
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold mb-2">Parámetros Básicos</h2>
        <p className="text-muted-foreground">
          Ajusta la dosis, rendimiento y tiempo de extracción.
        </p>
      </div>

      {/* Smart Suggestions */}
      {selectedProfile && (
        <SmartSuggestions
          profile={selectedProfile}
          approvedEntry={approvedEntry}
          onUseLastCalibration={handleUseLastCalibration}
          currentValues={{
            ratio,
            timeS: debouncedTimeS,
            semaphore: semaphore?.overallStatus || "good",
          }}
        />
      )}

      {/* Parameter Cards */}
      <div className="grid gap-4">
        <ParameterCard
          title="Dosis"
          description="Cantidad de café molido"
          status={semaphore?.overallStatus}
        >
          <TouchStepper
            value={state.doseG}
            onChange={(v) => updateState({ doseG: v })}
            step={settings?.default_steps.dose_g || 0.1}
            min={10}
            max={30}
            unit="g"
            size="large"
          />
        </ParameterCard>

        <ParameterCard
          title="Rendimiento"
          description="Café extraído"
          status={semaphore?.ratioStatus}
          metric={ratio ? `Ratio: ${ratio.toFixed(2)}` : undefined}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <TouchStepper
                value={state.yieldValue}
                onChange={(v) => updateState({ yieldValue: v })}
                step={1}
                min={20}
                max={80}
                unit={state.yieldUnit}
                size="large"
              />
            </div>
            <Button
              variant="outline"
              size="lg"
              onClick={() => updateState({ yieldUnit: state.yieldUnit === "g" ? "ml" : "g" })}
              className="h-14 w-14 text-lg font-semibold"
            >
              {state.yieldUnit}
            </Button>
          </div>
        </ParameterCard>

        <ParameterCard
          title="Tiempo"
          description="Duración de extracción"
          status={semaphore?.timeStatus}
        >
          <TouchStepper
            value={state.timeS}
            onChange={(v) => updateState({ timeS: v })}
            step={1}
            min={15}
            max={60}
            unit="s"
            size="large"
          />
        </ParameterCard>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onPrevious} className="flex-1 h-12">
          <ChevronLeft className="w-5 h-5 mr-2" />
          Anterior
        </Button>
        <Button onClick={onNext} disabled={!canNavigateNext} className="flex-1 h-12">
          Continuar
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
