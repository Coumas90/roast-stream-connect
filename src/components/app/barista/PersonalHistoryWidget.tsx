import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, CheckCircle, XCircle, Clock } from "lucide-react";
import { useRecentCalibrations } from "@/hooks/useRecentCalibrations";
import { useProfile } from "@/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function PersonalHistoryWidget() {
  const { profile } = useProfile();
  const { data: calibrations, isLoading } = useRecentCalibrations(profile?.id, 10);

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <Card className="shadow-elegant border-0 bg-gradient-card h-full">
      <CardHeader className="border-b border-border/50">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <History className="h-5 w-5 text-amber-500" />
          </div>
          Mi Historial Reciente
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {calibrations && calibrations.length > 0 ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {calibrations.map((cal) => {
                const ratio = cal.ratio_calc || (cal.yield_value / cal.dose_g);
                const isGoodRatio = ratio >= 1.8 && ratio <= 2.2;
                
                return (
                  <div
                    key={cal.id}
                    className="p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors border border-transparent hover:border-primary/20"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">
                          {cal.coffee_name || cal.recipe_name || 'Sin nombre'}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(cal.created_at), { 
                              addSuffix: true, 
                              locale: es 
                            })}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {cal.turno}
                          </Badge>
                        </div>
                      </div>
                      
                      {cal.approved ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-amber-500" />
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Ratio:</span>
                        <span className={`ml-1 font-medium ${isGoodRatio ? 'text-green-500' : 'text-amber-500'}`}>
                          1:{ratio.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tiempo:</span>
                        <span className="ml-1 font-medium">{cal.time_s}s</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Temp:</span>
                        <span className="ml-1 font-medium">{cal.temp_c}°C</span>
                      </div>
                    </div>

                    {cal.notes_tags && cal.notes_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {cal.notes_tags.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-12">
            <History className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No hay calibraciones registradas aún
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
