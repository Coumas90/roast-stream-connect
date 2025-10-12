import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRecipeCalibrations } from "@/hooks/useRecipeCalibrations";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Thermometer, Scale, Users, CheckCircle2, XCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { formatTimeAgo } from "@/lib/utils";

interface RecipeCalibrationsModalProps {
  recipeId: string;
  recipeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecipeCalibrationsModal({
  recipeId,
  recipeName,
  open,
  onOpenChange,
}: RecipeCalibrationsModalProps) {
  const { data: metrics, isLoading } = useRecipeCalibrations(recipeId);

  if (isLoading || !metrics) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cargando calibraciones...</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial de Calibraciones</DialogTitle>
          <p className="text-sm text-muted-foreground">{recipeName}</p>
        </DialogHeader>

        {metrics.total_calibrations === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No hay calibraciones registradas para esta receta</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Métricas generales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Tiempo Promedio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{metrics.avg_time_s}s</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-primary" />
                    Temp. Promedio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{metrics.avg_temp_c}°C</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Scale className="h-4 w-4 text-primary" />
                    Ratio Promedio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">1:{metrics.avg_ratio}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Baristas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{metrics.unique_baristas}</p>
                  <p className="text-xs text-muted-foreground">{metrics.total_calibrations} calibraciones</p>
                </CardContent>
              </Card>
            </div>

            {/* Top Baristas */}
            {metrics.baristas.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Baristas que usaron esta receta</h3>
                <div className="flex flex-wrap gap-2">
                  {metrics.baristas.slice(0, 5).map((barista) => (
                    <Badge key={barista.id} variant="secondary">
                      {barista.name} ({barista.count})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Calibraciones recientes */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Calibraciones Recientes</h3>
              <div className="space-y-3">
                {metrics.recent_calibrations.map((cal) => (
                  <Card key={cal.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{cal.barista_name}</p>
                            {cal.approved ? (
                              <Badge variant="default" className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Aprobada
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <XCircle className="h-3 w-3" />
                                No aprobada
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(cal.fecha).toLocaleDateString()} - {cal.turno}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {cal.time_s}s
                            </span>
                            <span className="flex items-center gap-1">
                              <Thermometer className="h-3 w-3" />
                              {cal.temp_c}°C
                            </span>
                            <span className="flex items-center gap-1">
                              <Scale className="h-3 w-3" />
                              1:{cal.ratio_calc}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
