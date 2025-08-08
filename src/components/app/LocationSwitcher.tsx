import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenant } from "@/lib/tenant";

export default function LocationSwitcher() {
  const { locations, location, setLocation } = useTenant();
  return (
    <div className="min-w-[160px]">
      <Select value={location} onValueChange={setLocation}>
        <SelectTrigger aria-label="Seleccionar sucursal" className="w-[180px]">
          <SelectValue placeholder="Sucursal" />
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
