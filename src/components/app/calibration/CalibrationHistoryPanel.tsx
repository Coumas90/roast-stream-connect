import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CalibrationEntry {
  id: string;
  dose_g: number;
  yield_value: number;
  yield_unit: string;
  time_s: number;
  temp_c: number;
  grind_points: number;
  ratio_calc: number | null;
  approved: boolean;
  created_at: string;
  notes_tags: string[];
}

interface CalibrationHistoryPanelProps {
  entries: CalibrationEntry[];
  approvedEntryId?: string;
}

export function CalibrationHistoryPanel({ entries, approvedEntryId }: CalibrationHistoryPanelProps) {
  if (entries.length === 0) {
    return (
      <Card className="p-4 text-center text-sm text-muted-foreground">
        No hay calibraciones registradas para este turno
      </Card>
    );
  }

  const getDelta = (current: number, previous: number) => {
    const delta = current - previous;
    if (Math.abs(delta) < 0.01) return null;
    return delta;
  };

  const renderDelta = (delta: number | null, unit: string = "") => {
    if (delta === null) return <Minus className="w-3 h-3 text-muted-foreground" />;
    
    const isPositive = delta > 0;
    const Icon = isPositive ? ArrowUp : ArrowDown;
    const color = isPositive ? "text-green-600" : "text-red-600";

    return (
      <span className={cn("flex items-center gap-1 text-xs font-medium", color)}>
        <Icon className="w-3 h-3" />
        {Math.abs(delta).toFixed(1)}{unit}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Historial del Turno</h3>
        <Badge variant="outline" className="ml-auto">
          {entries.length} {entries.length === 1 ? "calibración" : "calibraciones"}
        </Badge>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {entries.map((entry, index) => {
          const previousEntry = entries[index + 1];
          const isApproved = entry.id === approvedEntryId || entry.approved;

          return (
            <Card
              key={entry.id}
              className={cn(
                "p-3 transition-all",
                isApproved && "border-green-500 bg-green-50/50 dark:bg-green-950/20"
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(entry.created_at), "HH:mm", { locale: es })}
                  </span>
                  {isApproved && (
                    <Badge variant="default" className="text-xs py-0 h-5">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Aprobada
                    </Badge>
                  )}
                </div>
                {entry.notes_tags.length > 0 && (
                  <div className="flex gap-1">
                    {entry.notes_tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground mb-1">Dosis</div>
                  <div className="font-semibold">{entry.dose_g}g</div>
                  {previousEntry && (
                    <div className="mt-0.5">
                      {renderDelta(getDelta(entry.dose_g, previousEntry.dose_g), "g")}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-muted-foreground mb-1">Ratio</div>
                  <div className="font-semibold">{entry.ratio_calc?.toFixed(2) || "-"}</div>
                  {previousEntry && previousEntry.ratio_calc && entry.ratio_calc && (
                    <div className="mt-0.5">
                      {renderDelta(getDelta(entry.ratio_calc, previousEntry.ratio_calc))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-muted-foreground mb-1">Tiempo</div>
                  <div className="font-semibold">{entry.time_s}s</div>
                  {previousEntry && (
                    <div className="mt-0.5">
                      {renderDelta(getDelta(entry.time_s, previousEntry.time_s), "s")}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-muted-foreground mb-1">Molienda</div>
                  <div className="font-semibold">{entry.grind_points.toFixed(1)}</div>
                  {previousEntry && (
                    <div className="mt-0.5">
                      {renderDelta(getDelta(entry.grind_points, previousEntry.grind_points))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
