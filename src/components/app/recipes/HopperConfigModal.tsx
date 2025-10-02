import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useTupaCoffees } from "@/hooks/useCoffeeVarieties";
import { useStockManagement } from "@/hooks/useStockManagement";
import { useTenant } from "@/lib/tenant";
import { useStockMetrics } from "@/hooks/useLocationStock";
import { Coffee } from "lucide-react";

interface HopperConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HopperConfigModal({ open, onOpenChange }: HopperConfigModalProps) {
  const { locationId } = useTenant();
  const { data: tupaCoffees, isLoading: loadingCoffees } = useTupaCoffees();
  const { stockItems } = useStockMetrics(locationId);
  const { upsertHopperStock } = useStockManagement();

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
      const promises = [];

      if (hopper1Coffee) {
        promises.push(
          upsertHopperStock.mutateAsync({
            locationId,
            hopperNumber: 1,
            coffeeVarietyId: hopper1Coffee,
          })
        );
      }

      if (hopper2Coffee) {
        promises.push(
          upsertHopperStock.mutateAsync({
            locationId,
            hopperNumber: 2,
            coffeeVarietyId: hopper2Coffee,
          })
        );
      }

      await Promise.all(promises);
      console.log('Hopper configuration saved successfully');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving hopper configuration:', error);
    }
  };

  const isSaveDisabled = !hopper1Coffee && !hopper2Coffee;

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
            <Label htmlFor="hopper1" className="text-sm font-medium">
              Tolva 1 (Principal)
            </Label>
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
            <Label htmlFor="hopper2" className="text-sm font-medium">
              Tolva 2 (Secundaria)
            </Label>
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
            disabled={isSaveDisabled || upsertHopperStock.isPending}
          >
            {upsertHopperStock.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
