import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChevronRight, Zap } from "lucide-react";
import { useCoffeeProfiles } from "@/hooks/useCoffeeProfiles";
import { useTodayApprovedEntry } from "@/hooks/useCalibrationEntries";
import { WizardState } from "../CalibrationWizard";

interface SelectCoffeeStepProps {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  locationId?: string;
  onNext: () => void;
  canNavigateNext: boolean;
}

export function SelectCoffeeStep({ state, updateState, locationId, onNext, canNavigateNext }: SelectCoffeeStepProps) {
  const { data: coffeeProfiles = [] } = useCoffeeProfiles(locationId);
  const { data: approvedEntry } = useTodayApprovedEntry(state.selectedProfileId, state.turno);

  // Auto-select if only one profile
  useEffect(() => {
    if (coffeeProfiles.length === 1 && !state.selectedProfileId) {
      updateState({ selectedProfileId: coffeeProfiles[0].id });
    }
  }, [coffeeProfiles, state.selectedProfileId, updateState]);

  // Smart shift detection
  const getCurrentShift = (): typeof state.turno => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) return "mañana";
    if (hour >= 14 && hour < 20) return "tarde";
    return "noche";
  };

  // Auto-select current shift
  useEffect(() => {
    if (!state.turno) {
      updateState({ turno: getCurrentShift() });
    }
  }, [state.turno, updateState]);

  const handleQuickStart = (profileId: string) => {
    updateState({ selectedProfileId: profileId, turno: getCurrentShift() });
    setTimeout(onNext, 300); // Small delay for smooth transition
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold mb-2">Selecciona el café y turno</h2>
        <p className="text-muted-foreground">
          Comienza eligiendo qué café vas a calibrar y en qué turno trabajas.
        </p>
      </div>

      {/* Quick Start Cards */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <Label className="text-sm font-semibold">Inicio Rápido</Label>
        </div>
        <div className="grid gap-3">
          {coffeeProfiles.map((profile) => (
            <Card
              key={profile.id}
              className="p-4 cursor-pointer hover:border-primary transition-all hover-scale"
              onClick={() => handleQuickStart(profile.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{profile.name}</div>
                  {profile.lote && (
                    <div className="text-sm text-muted-foreground">Lote: {profile.lote}</div>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Manual Selection */}
      <div className="space-y-4">
        <Label className="text-sm font-semibold">O selecciona manualmente</Label>
        
        <div className="space-y-2">
          <Label>Café</Label>
          <Select value={state.selectedProfileId} onValueChange={(v) => updateState({ selectedProfileId: v })}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Seleccionar café" />
            </SelectTrigger>
            <SelectContent>
              {coffeeProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{profile.name}</span>
                    {profile.lote && (
                      <span className="text-xs text-muted-foreground">Lote: {profile.lote}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Turno</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["mañana", "tarde", "noche"] as const).map((shift) => (
              <Button
                key={shift}
                variant={state.turno === shift ? "default" : "outline"}
                className="h-12 capitalize"
                onClick={() => updateState({ turno: shift })}
              >
                {shift}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {approvedEntry && (
        <Badge variant="secondary" className="w-full justify-center py-2">
          ✓ Ya existe calibración aprobada para hoy en este turno
        </Badge>
      )}

      <Button
        onClick={onNext}
        disabled={!canNavigateNext}
        className="w-full h-12"
        size="lg"
      >
        Continuar
        <ChevronRight className="w-5 h-5 ml-2" />
      </Button>
    </div>
  );
}
