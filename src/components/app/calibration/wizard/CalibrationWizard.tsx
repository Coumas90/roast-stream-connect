import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { WizardProgress } from "./WizardProgress";
import { SelectCoffeeStep } from "./steps/SelectCoffeeStep";
import { BasicParametersStep } from "./steps/BasicParametersStep";
import { FineAdjustmentsStep } from "./steps/FineAdjustmentsStep";
import { NotesStep } from "./steps/NotesStep";
import { ConfirmationStep } from "./steps/ConfirmationStep";
import { useOfflineCalibration } from "@/hooks/useOfflineCalibration";
import { CalibrationSession } from "@/lib/telemetry";

interface CalibrationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId?: string;
}

export type YieldUnit = "g" | "ml";
export type Turno = "mañana" | "tarde" | "noche";

export interface WizardState {
  // Step 1
  selectedProfileId: string;
  turno: Turno;
  
  // Step 2
  doseG: number;
  yieldValue: number;
  yieldUnit: YieldUnit;
  timeS: number;
  
  // Step 3
  tempC: number;
  grindPoints: number;
  grindLabel: string;
  
  // Step 4
  notesTags: string[];
  notesText: string;
  
  // Meta
  currentEntryId: string | null;
  previousGrindPoints?: number;
}

const INITIAL_STATE: WizardState = {
  selectedProfileId: "",
  turno: "mañana",
  doseG: 18,
  yieldValue: 36,
  yieldUnit: "g",
  timeS: 28,
  tempC: 93,
  grindPoints: 3.5,
  grindLabel: "",
  notesTags: [],
  notesText: "",
  currentEntryId: null,
};

export function CalibrationWizard({ open, onOpenChange, locationId }: CalibrationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const { loadLatestDraft, enableAutoSave } = useOfflineCalibration();
  const sessionRef = useRef<CalibrationSession | null>(null);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!open || !state.selectedProfileId) return;

    const draftId = `calibration-wizard-${state.selectedProfileId}-${state.turno}`;
    const cleanup = enableAutoSave(draftId, () => ({ ...state, currentStep }), 30000);
    return cleanup;
  }, [open, state, currentStep, enableAutoSave]);

  // Load draft on open
  useEffect(() => {
    if (open) {
      // Start telemetry session
      sessionRef.current = new CalibrationSession();
      
      loadLatestDraft().then((draft) => {
        if (draft && draft.data) {
          const data = draft.data as WizardState & { currentStep?: number };
          setState({ ...INITIAL_STATE, ...data });
          if (data.currentStep) {
            setCurrentStep(data.currentStep);
          }
        }
      });
    } else {
      // End session on close
      if (sessionRef.current) {
        sessionRef.current = null;
      }
    }
  }, [open, loadLatestDraft]);

  const updateState = (updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const steps = [
    { number: 1, title: "Café & Turno", component: SelectCoffeeStep },
    { number: 2, title: "Parámetros Básicos", component: BasicParametersStep },
    { number: 3, title: "Ajustes Finos", component: FineAdjustmentsStep },
    { number: 4, title: "Notas", component: NotesStep },
    { number: 5, title: "Confirmar", component: ConfirmationStep },
  ];

  const CurrentStepComponent = steps[currentStep - 1].component;
  const canNavigateNext = () => {
    switch (currentStep) {
      case 1:
        return state.selectedProfileId !== "";
      case 2:
        return state.doseG > 0 && state.yieldValue > 0 && state.timeS > 0;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length && canNavigateNext()) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleStepClick = (stepNumber: number) => {
    // Allow jumping to previous steps or next if current is valid
    if (stepNumber < currentStep || (stepNumber === currentStep + 1 && canNavigateNext())) {
      setCurrentStep(stepNumber);
    }
  };

  const handleComplete = () => {
    onOpenChange(false);
    // Reset state
    setState(INITIAL_STATE);
    setCurrentStep(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] p-0 flex flex-col">
        {/* Progress Stepper */}
        <WizardProgress
          steps={steps}
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <CurrentStepComponent
            state={state}
            updateState={updateState}
            locationId={locationId}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onComplete={handleComplete}
            canNavigateNext={canNavigateNext()}
            sessionRef={sessionRef}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
