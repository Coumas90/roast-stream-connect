import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Coffee, Clock } from "lucide-react";
import { useRecentCalibrations } from "@/hooks/useRecentCalibrations";
import { useProfile } from "@/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CoffeeEvolutionTimelineProps {
  coffeeProfileId?: string;
  onViewChart?: () => void;
}

export function CoffeeEvolutionTimeline({ coffeeProfileId, onViewChart }: CoffeeEvolutionTimelineProps) {
  const { profile } = useProfile();
  const { data: calibrations, isLoading } = useRecentCalibrations(profile?.id, 10);

  // Filter by coffee if specified and only today's approved
  const todayCalibrations = calibrations?.filter(cal => {
    const isToday = new Date(cal.fecha).toDateString() === new Date().toDateString();
    const matchesCoffee = coffeeProfileId ? cal.coffee_profile_id === coffeeProfileId : true;
    return isToday && cal.approved && matchesCoffee;
  }) || [];

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (todayCalibrations.length === 0) {
    return (
      <Card className="shadow-elegant border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coffee className="h-5 w-5 text-primary" />
            Evolución del Café
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-12">
          <Coffee className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No hay calibraciones aprobadas hoy
          </p>
        </CardContent>
      </Card>
    );
  }

  const getSemaphoreColor = (ratio: number, time: number) => {
    // Simple heuristic: 1.8-2.2 ratio and 25-32s time is good
    const ratioOk = ratio >= 1.8 && ratio <= 2.2;
    const timeOk = time >= 25 && time <= 32;
    
    if (ratioOk && timeOk) return "success";
    if (!ratioOk || !timeOk) return "warning";
    return "destructive";
  };

  return (
    <Card className="shadow-elegant border-0">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coffee className="h-5 w-5 text-primary" />
            Evolución del Café Hoy
          </div>
          {onViewChart && todayCalibrations.length > 2 && (
            <Button variant="ghost" size="sm" onClick={onViewChart}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Ver Gráfico
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {todayCalibrations.map((cal, idx) => {
            const ratio = cal.ratio_calc || 0;
            const semaphore = getSemaphoreColor(ratio, cal.time_s);
            const prevCal = idx < todayCalibrations.length - 1 ? todayCalibrations[idx + 1] : null;
            const grindChange = prevCal ? cal.dose_g - prevCal.dose_g : 0;

            return (
              <div key={cal.id} className="relative">
                {/* Timeline Entry */}
                <div
                  className={cn(
                    "p-4 rounded-lg border-l-4 transition-colors",
                    semaphore === "success" && "border-l-green-500 bg-green-500/5",
                    semaphore === "warning" && "border-l-amber-500 bg-amber-500/5",
                    semaphore === "destructive" && "border-l-red-500 bg-red-500/5"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {new Date(cal.created_at).toLocaleTimeString('es-ES', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <Badge variant={semaphore === "success" ? "default" : "secondary"} className="text-xs">
                      {cal.turno}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Ratio:</span>
                      <span className="ml-1 font-semibold">{ratio.toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tiempo:</span>
                      <span className="ml-1 font-semibold">{cal.time_s}s</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Temp:</span>
                      <span className="ml-1 font-semibold">{cal.temp_c}°C</span>
                    </div>
                  </div>

                  {cal.coffee_name && (
                    <p className="text-xs text-muted-foreground mt-2">
                      ☕ {cal.coffee_name}
                    </p>
                  )}
                </div>

                {/* Grind Change Arrow */}
                {idx < todayCalibrations.length - 1 && grindChange !== 0 && (
                  <div className="flex items-center justify-center my-2">
                    <div className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                      ↓ {grindChange > 0 ? '+' : ''}{grindChange.toFixed(1)} clicks
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary Stats */}
        <div className="mt-6 pt-6 border-t">
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="text-2xl font-bold text-primary">{todayCalibrations.length}</div>
              <div className="text-xs text-muted-foreground">Calibraciones</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {todayCalibrations.filter(c => getSemaphoreColor(c.ratio_calc || 0, c.time_s) === "success").length}
              </div>
              <div className="text-xs text-muted-foreground">Perfectas</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {todayCalibrations.length > 0 
                  ? (todayCalibrations.reduce((sum, c) => sum + (c.ratio_calc || 0), 0) / todayCalibrations.length).toFixed(1)
                  : '0.0'
                }
              </div>
              <div className="text-xs text-muted-foreground">Ratio Prom.</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
