import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Clock, Coffee, Thermometer, Timer } from "lucide-react";
import { useRecentCalibrations } from "@/hooks/useRecentCalibrations";
import { useProfile } from "@/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";

export function CalibrationHistoryCards() {
  const { profile } = useProfile();
  const { data: calibrations, isLoading } = useRecentCalibrations(profile?.id, 20);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (!calibrations || calibrations.length === 0) {
    return (
      <Card className="shadow-elegant border-0">
        <CardHeader>
          <CardTitle>Mis Calibraciones</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-12">
          <Coffee className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No hay calibraciones registradas aún
          </p>
        </CardContent>
      </Card>
    );
  }

  const groupedByDay = calibrations.reduce((acc, cal) => {
    const day = format(new Date(cal.fecha), "yyyy-MM-dd");
    if (!acc[day]) acc[day] = [];
    acc[day].push(cal);
    return acc;
  }, {} as Record<string, typeof calibrations>);

  const getSemaphoreColor = (ratio: number, time: number) => {
    const ratioOk = ratio >= 1.8 && ratio <= 2.2;
    const timeOk = time >= 25 && time <= 32;
    
    if (ratioOk && timeOk) return "success";
    if (!ratioOk || !timeOk) return "warning";
    return "destructive";
  };

  return (
    <Card className="shadow-elegant border-0">
      <CardHeader className="border-b">
        <CardTitle>Mis Calibraciones</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-6">
            {Object.entries(groupedByDay).map(([day, cals]) => (
              <div key={day} className="space-y-3">
                {/* Day Header */}
                <div className="sticky top-0 bg-background/95 backdrop-blur py-2 border-b">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {format(new Date(day), "EEEE, dd MMMM", { locale: es })}
                  </h3>
                </div>

                {/* Calibration Cards */}
                <div className="space-y-3">
                  {cals.map((cal) => {
                    const ratio = cal.ratio_calc || 0;
                    const semaphore = getSemaphoreColor(ratio, cal.time_s);
                    const isExpanded = expandedId === cal.id;

                    return (
                      <div
                        key={cal.id}
                        onClick={() => setExpandedId(isExpanded ? null : cal.id)}
                        className={cn(
                          "p-4 rounded-lg border cursor-pointer transition-all hover-scale",
                          semaphore === "success" && "bg-green-500/5 border-green-500/20 hover:border-green-500/40",
                          semaphore === "warning" && "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40",
                          semaphore === "destructive" && "bg-red-500/5 border-red-500/20 hover:border-red-500/40"
                        )}
                      >
                        {/* Header Row */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Coffee className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold">
                                {cal.coffee_name || cal.recipe_name || 'Calibración'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(cal.created_at).toLocaleTimeString('es-ES', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant="outline" className="text-xs capitalize">
                              {cal.turno}
                            </Badge>
                            {cal.approved ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <Clock className="h-5 w-5 text-amber-600" />
                            )}
                          </div>
                        </div>

                        {/* Key Metrics */}
                        <div className="grid grid-cols-4 gap-3 text-center py-3 bg-background/50 rounded-md">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Dosis</div>
                            <div className="font-semibold">{cal.dose_g}g</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Rend.</div>
                            <div className="font-semibold">{cal.yield_value}g</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Ratio</div>
                            <div className={cn(
                              "font-semibold",
                              semaphore === "success" && "text-green-600",
                              semaphore === "warning" && "text-amber-600",
                              semaphore === "destructive" && "text-red-600"
                            )}>
                              {ratio.toFixed(1)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Tiempo</div>
                            <div className="font-semibold">{cal.time_s}s</div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t animate-fade-in">
                            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                              <div className="flex items-center gap-2">
                                <Thermometer className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Temperatura:</span>
                                <span className="font-medium">{cal.temp_c}°C</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Timer className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Molienda:</span>
                                <span className="font-medium">{cal.dose_g}</span>
                              </div>
                            </div>

                            {/* Notes Tags */}
                            {cal.notes_tags && cal.notes_tags.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-2">
                                {cal.notes_tags.slice(0, 3).map((tag, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {/* Status */}
                            <div className="text-xs">
                              {cal.approved ? (
                                <span className="text-green-600 font-medium">✓ Calibración aprobada</span>
                              ) : (
                                <span className="text-amber-600 font-medium">⏳ Pendiente de aprobación</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
