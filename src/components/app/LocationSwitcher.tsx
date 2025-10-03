import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenant } from "@/lib/tenant";
import { Loader2, AlertCircle, MapPin, Coffee, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocationStats } from "@/hooks/useLocationStats";

export default function LocationSwitcher() {
  const { locations, location, setLocation, isLoading, error, retryCount, locationId } = useTenant();
  const { data: currentStats } = useLocationStats(locationId);
  
  if (isLoading) {
    return (
      <div className="min-w-[160px] flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">
          {retryCount > 0 ? `Reintentando... (${retryCount}/3)` : 'Cargando sucursales...'}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-w-[160px] flex items-center gap-2 text-destructive">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">Error: {error}</span>
      </div>
    );
  }

  return (
    <div className="min-w-[200px]">
      <Select value={location} onValueChange={setLocation} disabled={locations.length === 0}>
        <SelectTrigger aria-label="Seleccionar sucursal" className="w-[240px]">
          <div className="flex items-center gap-2 justify-between w-full">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder={locations.length === 0 ? "Sin sucursales" : "Sucursal"} />
            </div>
            {currentStats && currentStats.todayCalibrations > 0 && (
              <Badge variant="secondary" className="text-xs">
                {currentStats.todayCalibrations}
              </Badge>
            )}
          </div>
        </SelectTrigger>
        <SelectContent>
          {locations.map((loc) => (
            <SelectItem key={loc} value={loc}>
              <div className="flex items-center justify-between gap-4 w-full min-w-[180px]">
                <span className="font-medium">{loc}</span>
                <div className="flex items-center gap-2">
                  {currentStats && location === loc && (
                    <>
                      {currentStats.activeProfiles > 0 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Coffee className="h-3 w-3" />
                          {currentStats.activeProfiles}
                        </Badge>
                      )}
                      {currentStats.todayCalibrations > 0 && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Activity className="h-3 w-3" />
                          {currentStats.todayCalibrations}
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
