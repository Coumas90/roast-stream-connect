import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTenantLocationsStats } from "@/hooks/useLocationStats";
import { useTenant } from "@/lib/tenant";
import { MapPin, TrendingUp, TrendingDown, AlertTriangle, Coffee, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function CalibrationCompare() {
  const { locationId } = useTenant();
  
  // For now, we'll need to get tenant_id from a location query
  // In production, you might want to add tenant_id to TenantContext
  const { data: stats, isLoading } = useTenantLocationsStats(undefined);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!stats || stats.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Coffee className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay datos para comparar</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate overall averages
  const overallAvgRatio = stats.reduce((sum, s) => sum + (s.avgRatio || 0), 0) / stats.filter(s => s.avgRatio).length;
  const overallAvgTime = stats.reduce((sum, s) => sum + (s.avgTime || 0), 0) / stats.filter(s => s.avgTime).length;

  // Detect outliers (more than 10% deviation from average)
  const detectOutlier = (value: number | null, avg: number, threshold = 0.1) => {
    if (!value) return null;
    const deviation = Math.abs(value - avg) / avg;
    return deviation > threshold;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Comparación entre Sucursales</h2>
        <p className="text-muted-foreground">
          Análisis comparativo de métricas de calibración entre todas las sucursales
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sucursales Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ratio Promedio Global
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {overallAvgRatio ? overallAvgRatio.toFixed(2) : 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tiempo Promedio Global
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {overallAvgTime ? `${overallAvgTime.toFixed(0)}s` : 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Locations Comparison */}
      <div className="space-y-3">
        {stats.map((location) => {
          const isCurrentLocation = location.locationId === locationId;
          const ratioOutlier = detectOutlier(location.avgRatio, overallAvgRatio);
          const timeOutlier = detectOutlier(location.avgTime, overallAvgTime);
          const hasOutliers = ratioOutlier || timeOutlier;

          return (
            <Card 
              key={location.locationId}
              className={isCurrentLocation ? "border-primary" : ""}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{location.locationName}</CardTitle>
                    {isCurrentLocation && (
                      <Badge>Actual</Badge>
                    )}
                  </div>
                  {hasOutliers && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Outlier
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Active Profiles */}
                  <div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Coffee className="h-3 w-3" />
                      Perfiles
                    </div>
                    <p className="text-xl font-bold">{location.activeProfiles}</p>
                  </div>

                  {/* Today Calibrations */}
                  <div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Activity className="h-3 w-3" />
                      Hoy
                    </div>
                    <p className="text-xl font-bold">{location.todayCalibrations}</p>
                  </div>

                  {/* Avg Ratio */}
                  <div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <span>Ratio</span>
                      {ratioOutlier && location.avgRatio && (
                        location.avgRatio > overallAvgRatio 
                          ? <TrendingUp className="h-3 w-3 text-destructive" />
                          : <TrendingDown className="h-3 w-3 text-destructive" />
                      )}
                    </div>
                    <p className={`text-xl font-bold ${ratioOutlier ? 'text-destructive' : ''}`}>
                      {location.avgRatio ? location.avgRatio.toFixed(2) : 'N/A'}
                    </p>
                  </div>

                  {/* Avg Time */}
                  <div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <span>Tiempo</span>
                      {timeOutlier && location.avgTime && (
                        location.avgTime > overallAvgTime 
                          ? <TrendingUp className="h-3 w-3 text-destructive" />
                          : <TrendingDown className="h-3 w-3 text-destructive" />
                      )}
                    </div>
                    <p className={`text-xl font-bold ${timeOutlier ? 'text-destructive' : ''}`}>
                      {location.avgTime ? `${location.avgTime.toFixed(0)}s` : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Deviation Warning */}
                {hasOutliers && (
                  <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-xs text-destructive font-medium">
                      ⚠️ Esta sucursal muestra valores que se desvían significativamente del promedio global
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Standardization Suggestions */}
      {stats.some(s => 
        detectOutlier(s.avgRatio, overallAvgRatio) || 
        detectOutlier(s.avgTime, overallAvgTime)
      ) && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-amber-900 dark:text-amber-100 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Recomendación de Estandarización
            </CardTitle>
            <CardDescription className="text-amber-800 dark:text-amber-200">
              Se detectaron inconsistencias entre sucursales
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-amber-900 dark:text-amber-100 space-y-2">
            <p>• Revisa los parámetros de calibración en las sucursales con desviaciones</p>
            <p>• Verifica que todas las sucursales usen los mismos perfiles de café</p>
            <p>• Considera organizar una sesión de capacitación para estandarizar procedimientos</p>
            <p>• Compara los equipos (molinos, máquinas) entre sucursales</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
