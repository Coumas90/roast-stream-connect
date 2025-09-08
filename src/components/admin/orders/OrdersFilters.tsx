import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  slug: string | null;
}

interface Location {
  id: string;
  name: string;
  tenant_id: string;
}

interface OrdersFiltersProps {
  tenants: Tenant[];
  locations: Location[];
  filters: {
    tenantId: string;
    locationId: string;
    status: string;
  };
  onFiltersChange: (filters: { tenantId: string; locationId: string; status: string }) => void;
}

export function OrdersFilters({ tenants, locations, filters, onFiltersChange }: OrdersFiltersProps) {
  const filteredLocations = React.useMemo(() => {
    if (!filters.tenantId) return locations;
    return locations.filter(loc => loc.tenant_id === filters.tenantId);
  }, [locations, filters.tenantId]);

  const handleTenantChange = (tenantId: string) => {
    onFiltersChange({
      ...filters,
      tenantId,
      locationId: "", // Reset location when tenant changes
    });
  };

  const handleLocationChange = (locationId: string) => {
    onFiltersChange({
      ...filters,
      locationId,
    });
  };

  const handleStatusChange = (status: string) => {
    onFiltersChange({
      ...filters,
      status,
    });
  };

  const resetFilters = () => {
    onFiltersChange({
      tenantId: "",
      locationId: "",
      status: "",
    });
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="tenant">Cliente</Label>
            <Select value={filters.tenantId} onValueChange={handleTenantChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos los clientes</SelectItem>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Sucursal</Label>
            <Select value={filters.locationId} onValueChange={handleLocationChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las sucursales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas las sucursales</SelectItem>
                {filteredLocations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <Select value={filters.status} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos los estados</SelectItem>
                <SelectItem value="draft">Borrador</SelectItem>
                <SelectItem value="approved">Aprobado</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="fulfilled">Entregado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Button 
              variant="outline" 
              onClick={resetFilters}
              className="w-full"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}