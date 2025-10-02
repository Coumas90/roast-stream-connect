import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coffee, ChevronRight, AlertTriangle } from "lucide-react";
import { useStockMetrics } from "@/hooks/useLocationStock";
import { useTenant } from "@/lib/tenant";
import { useState } from "react";
import { HopperManagementModal } from "./HopperManagementModal";
import { HopperConfigModal } from "./HopperConfigModal";

export function HopperInfoWidget() {
  const { locationId } = useTenant();
  const { stockItems, isLoading } = useStockMetrics(locationId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Get primary hoppers (1 and 2)
  const primaryHoppers = stockItems
    .filter(item => item.hopper_number <= 2)
    .sort((a, b) => a.hopper_number - b.hopper_number);

  if (isLoading) {
    return (
      <Card className="p-4 animate-pulse">
        <div className="h-20 bg-muted rounded" />
      </Card>
    );
  }

  // Show empty state if no hoppers configured
  if (!locationId) {
    return null;
  }

  if (primaryHoppers.length === 0) {
    return (
      <Card className="p-4 border-dashed border-2 border-muted-foreground/20 bg-muted/20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Coffee className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                No hay tolvas configuradas
              </p>
              <p className="text-xs text-muted-foreground">
                Configura el stock de café para ver la información aquí
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              console.log('Configurar button clicked');
              setIsConfigModalOpen(true);
            }}
          >
            Configurar
          </Button>
        </div>
      </Card>
    );
  }

  const getStockStatus = (kg: number) => {
    if (kg === 0) return { color: "text-muted-foreground", bg: "bg-muted", label: "Vacía" };
    if (kg < 2) return { color: "text-destructive", bg: "bg-destructive/10", label: "Crítico" };
    if (kg < 5) return { color: "text-warning", bg: "bg-warning/10", label: "Bajo" };
    return { color: "text-success", bg: "bg-success/10", label: "Bueno" };
  };

  return (
    <>
      <Card className="p-4 border-primary/20 bg-gradient-to-r from-card to-primary/5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            {primaryHoppers.map((hopper) => {
              const status = getStockStatus(hopper.current_kg);
              return (
                <div 
                  key={hopper.id} 
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg ${status.bg} flex-1 min-w-0`}
                >
                  <div className="flex-shrink-0">
                    <Coffee className={`w-5 h-5 ${status.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Tolva {hopper.hopper_number}
                      </span>
                      {hopper.current_kg < 2 && (
                        <AlertTriangle className="w-3 h-3 text-destructive" />
                      )}
                    </div>
                    <p className="font-semibold text-sm text-foreground truncate">
                      {hopper.coffee_varieties.name}
                    </p>
                    <p className={`text-xs ${status.color}`}>
                      {hopper.current_kg.toFixed(1)} kg - {status.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="flex-shrink-0"
          >
            Ver todas
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </Card>

      <HopperManagementModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
      
      <HopperConfigModal
        open={isConfigModalOpen}
        onOpenChange={setIsConfigModalOpen}
      />
    </>
  );
}
