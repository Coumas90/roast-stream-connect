import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useTupaCoffees } from "@/hooks/useCoffeeVarieties";
import { useStockManagement } from "@/hooks/useStockManagement";
import { useTenant } from "@/lib/tenant";
import { useStockMetrics } from "@/hooks/useLocationStock";
import { Coffee, X } from "lucide-react";

interface HopperConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HopperConfigModal({ open, onOpenChange }: HopperConfigModalProps) {
  console.log('HopperConfigModal component called', { open });
  
  const { locationId } = useTenant();
  const { data: tupaCoffees, isLoading: loadingCoffees } = useTupaCoffees();
  const { stockItems } = useStockMetrics(locationId);
  const { upsertHopperStock, deleteHopperStock } = useStockManagement();

  console.log('HopperConfigModal data loaded:', { 
    locationId, 
    tupaCoffeesCount: tupaCoffees?.length,
    stockItemsCount: stockItems?.length 
  });

  // Get current hopper configurations
  const hopper1 = stockItems.find(item => item.hopper_number === 1);
  const hopper2 = stockItems.find(item => item.hopper_number === 2);

  const [hopper1Coffee, setHopper1Coffee] = useState<string>("");
  const [hopper2Coffee, setHopper2Coffee] = useState<string>("");

  // Sync state with current data when modal opens or data changes
  useEffect(() => {
    console.log('HopperConfigModal effect triggered:', { open, hopper1: hopper1?.coffee_variety_id, hopper2: hopper2?.coffee_variety_id });
    if (open) {
      setHopper1Coffee(hopper1?.coffee_variety_id || "");
      setHopper2Coffee(hopper2?.coffee_variety_id || "");
      console.log('Modal opened, current hoppers:', { 
        hopper1: hopper1?.coffee_variety_id, 
        hopper2: hopper2?.coffee_variety_id 
      });
    }
  }, [open, hopper1?.coffee_variety_id, hopper2?.coffee_variety_id]);

  const handleSave = async () => {
    if (!locationId) {
      console.error('No locationId available');
      return;
    }

    console.log('Saving hopper configuration:', { locationId, hopper1Coffee, hopper2Coffee });

    try {
      // Primero hacer todos los deletes
      const deletePromises = [];
      
      if (!hopper1Coffee && hopper1) {
        deletePromises.push(
          deleteHopperStock.mutateAsync({
            locationId,
            hopperNumber: 1,
          })
        );
      }
      
      if (!hopper2Coffee && hopper2) {
        deletePromises.push(
          deleteHopperStock.mutateAsync({
            locationId,
            hopperNumber: 2,
          })
        );
      }

      // Esperar a que los deletes completen
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
        // Pequeña pausa para asegurar que la DB procesó los deletes
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Luego hacer los upserts
      const upsertPromises = [];

      if (hopper1Coffee) {
        upsertPromises.push(
          upsertHopperStock.mutateAsync({
            locationId,
            hopperNumber: 1,
            coffeeVarietyId: hopper1Coffee,
          })
        );
      }

      if (hopper2Coffee) {
        upsertPromises.push(
          upsertHopperStock.mutateAsync({
            locationId,
            hopperNumber: 2,
            coffeeVarietyId: hopper2Coffee,
          })
        );
      }

      if (upsertPromises.length > 0) {
        await Promise.all(upsertPromises);
      }

      console.log('Hopper configuration saved successfully');
      
      // Esperar un momento antes de cerrar para que las queries se refresquen
      await new Promise(resolve => setTimeout(resolve, 200));
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving hopper configuration:', error);
    }
  };

  const isSaveDisabled = upsertHopperStock.isPending || deleteHopperStock.isPending;

  console.log('HopperConfigModal render:', { open, locationId, coffeeCount: tupaCoffees?.length });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coffee className="w-5 h-5" />
            Seleccionar Café por Tolva
          </DialogTitle>
          <DialogDescription>
            Configura qué café TUPÁ utilizarás en cada tolva de tu máquina.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Tolva 1 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="hopper1" className="text-sm font-medium">
                Tolva 1 (Principal)
              </Label>
              {hopper1Coffee && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHopper1Coffee("")}
                  className="h-6 px-2 text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3 h-3 mr-1" />
                  Quitar
                </Button>
              )}
            </div>
            <Select
              value={hopper1Coffee}
              onValueChange={setHopper1Coffee}
              disabled={loadingCoffees}
            >
              <SelectTrigger id="hopper1" className="w-full bg-background">
                <SelectValue placeholder="Seleccionar café TUPÁ" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {tupaCoffees?.map((coffee) => (
                  <SelectItem key={coffee.id} value={coffee.id}>
                    {coffee.name}
                    {coffee.origin && ` - ${coffee.origin}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tolva 2 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="hopper2" className="text-sm font-medium">
                Tolva 2 (Secundaria)
              </Label>
              {hopper2Coffee && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHopper2Coffee("")}
                  className="h-6 px-2 text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3 h-3 mr-1" />
                  Quitar
                </Button>
              )}
            </div>
            <Select
              value={hopper2Coffee}
              onValueChange={setHopper2Coffee}
              disabled={loadingCoffees}
            >
              <SelectTrigger id="hopper2" className="w-full bg-background">
                <SelectValue placeholder="Seleccionar café TUPÁ" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {tupaCoffees?.map((coffee) => (
                  <SelectItem key={coffee.id} value={coffee.id}>
                    {coffee.name}
                    {coffee.origin && ` - ${coffee.origin}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaveDisabled}
          >
            {isSaveDisabled ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
