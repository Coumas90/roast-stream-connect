import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenant } from "@/lib/tenant";
import { Loader2, AlertCircle } from "lucide-react";

export default function LocationSwitcher() {
  const { locations, location, setLocation, isLoading, error, retryCount } = useTenant();
  
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
    <div className="min-w-[160px]">
      <Select value={location} onValueChange={setLocation} disabled={locations.length === 0}>
        <SelectTrigger aria-label="Seleccionar sucursal" className="w-[180px]">
          <SelectValue placeholder={locations.length === 0 ? "Sin sucursales" : "Sucursal"} />
        </SelectTrigger>
        <SelectContent>
          {locations.map((loc) => (
            <SelectItem key={loc} value={loc}>
              {loc}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
