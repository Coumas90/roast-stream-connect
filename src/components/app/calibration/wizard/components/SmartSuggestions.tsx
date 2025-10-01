import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, History, Sparkles } from "lucide-react";

interface SmartSuggestionsProps {
  profile: any;
  approvedEntry: any;
  onUseLastCalibration?: () => void;
  currentValues: {
    ratio: number;
    timeS: number;
    semaphore: string;
  };
}

export function SmartSuggestions({
  profile,
  approvedEntry,
  onUseLastCalibration,
  currentValues,
}: SmartSuggestionsProps) {
  const getContextualTip = () => {
    const { ratio, timeS, semaphore } = currentValues;

    if (semaphore === "good") {
      return {
        icon: <Sparkles className="w-5 h-5" />,
        text: "¡Excelente! Los parámetros están en el rango óptimo.",
        variant: "default" as const,
      };
    }

    if (ratio < profile.target_ratio_min) {
      return {
        icon: <Lightbulb className="w-5 h-5" />,
        text: "El ratio está bajo. Intenta aumentar el rendimiento o reducir la dosis.",
        variant: "secondary" as const,
      };
    }

    if (ratio > profile.target_ratio_max) {
      return {
        icon: <Lightbulb className="w-5 h-5" />,
        text: "El ratio está alto. Intenta reducir el rendimiento o aumentar la dosis.",
        variant: "secondary" as const,
      };
    }

    if (timeS < profile.target_time_min) {
      return {
        icon: <Lightbulb className="w-5 h-5" />,
        text: "Extracción muy rápida. Considera moler más fino o aumentar la dosis.",
        variant: "secondary" as const,
      };
    }

    if (timeS > profile.target_time_max) {
      return {
        icon: <Lightbulb className="w-5 h-5" />,
        text: "Extracción muy lenta. Considera moler más grueso o reducir la dosis.",
        variant: "secondary" as const,
      };
    }

    return null;
  };

  const tip = getContextualTip();

  return (
    <div className="space-y-3">
      {/* Contextual Tip */}
      {tip && (
        <Card className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-start gap-3">
            <div className="text-primary mt-0.5">{tip.icon}</div>
            <p className="text-sm flex-1">{tip.text}</p>
          </div>
        </Card>
      )}

      {/* Quick Action: Use Last Calibration */}
      {approvedEntry && onUseLastCalibration && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Usar última calibración</p>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>{approvedEntry.dose_g}g</span>
                  <span>→</span>
                  <span>{approvedEntry.yield_value}{approvedEntry.yield_unit}</span>
                  <span>@{approvedEntry.time_s}s</span>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onUseLastCalibration}>
              Usar
            </Button>
          </div>
        </Card>
      )}

      {/* Target Ranges */}
      <Card className="p-4 bg-muted/30">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Rangos Objetivo
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Ratio: </span>
              <Badge variant="outline" className="ml-1">
                {profile.target_ratio_min} - {profile.target_ratio_max}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Tiempo: </span>
              <Badge variant="outline" className="ml-1">
                {profile.target_time_min}s - {profile.target_time_max}s
              </Badge>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
