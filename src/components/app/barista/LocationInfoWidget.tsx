import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Coffee, Package, Activity } from "lucide-react";
import { useLocationStats } from "@/hooks/useLocationStats";
import { useLocationStockReadonly } from "@/hooks/useLocationStockReadonly";
import { useTenant } from "@/lib/tenant";

export function LocationInfoWidget() {
  const { locationId, location } = useTenant();
  const { data: stats } = useLocationStats(locationId);
  const { data: hoppers } = useLocationStockReadonly(locationId);

  if (!stats) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5 text-primary" />
          {location || "Ubicación"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Coffee className="h-4 w-4" />
              <span>Perfiles activos</span>
            </div>
            <p className="text-2xl font-bold">{stats.activeProfiles}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              <span>Calibraciones hoy</span>
            </div>
            <p className="text-2xl font-bold">{stats.todayCalibrations}</p>
          </div>
        </div>

        {/* Hoppers Status */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Package className="h-4 w-4" />
              <span>Hoppers</span>
            </div>
            <Badge variant={stats.hoppersFilled === stats.totalHoppers ? "default" : "secondary"}>
              {stats.hoppersFilled}/{stats.totalHoppers} activos
            </Badge>
          </div>
          
          {hoppers && hoppers.length > 0 && (
            <div className="space-y-2 mt-3">
              {hoppers.map((hopper) => (
                <div 
                  key={hopper.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-background px-1.5 py-0.5 rounded">
                      H{hopper.hopper_number}
                    </span>
                    <span className="text-sm font-medium truncate max-w-[140px]">
                      {hopper.coffee_name || "Sin café"}
                    </span>
                  </div>
                  <Badge 
                    variant={hopper.current_kg > 5 ? "default" : hopper.current_kg > 0 ? "secondary" : "outline"}
                    className="text-xs"
                  >
                    {hopper.current_kg.toFixed(1)}kg
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Average metrics */}
        {stats.avgRatio !== null && stats.avgTime !== null && (
          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-2">Promedios de hoy</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/50 p-2 rounded-md">
                <p className="text-xs text-muted-foreground">Ratio</p>
                <p className="font-bold">{stats.avgRatio.toFixed(2)}</p>
              </div>
              <div className="bg-muted/50 p-2 rounded-md">
                <p className="text-xs text-muted-foreground">Tiempo</p>
                <p className="font-bold">{stats.avgTime.toFixed(0)}s</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
