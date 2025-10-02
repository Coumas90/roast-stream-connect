import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coffee, ChevronRight, AlertTriangle, Settings2, Gauge } from "lucide-react";
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

  console.log('HopperInfoWidget render:', { locationId, isConfigModalOpen, stockItemsCount: stockItems.length });

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
      <>
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
        
        <HopperConfigModal
          open={isConfigModalOpen}
          onOpenChange={(open) => {
            console.log('HopperConfigModal onOpenChange called:', open);
            setIsConfigModalOpen(open);
          }}
        />
      </>
    );
  }

  const getStockStatus = (kg: number) => {
    if (kg === 0) return { 
      color: "text-muted-foreground", 
      bg: "bg-gradient-to-br from-muted/50 to-muted",
      badge: "bg-muted text-muted-foreground",
      ring: "ring-muted/20",
      label: "Vacía",
      icon: AlertTriangle
    };
    if (kg < 2) return { 
      color: "text-destructive", 
      bg: "bg-gradient-to-br from-destructive/10 via-destructive/5 to-destructive/10",
      badge: "bg-destructive/20 text-destructive border-destructive/30",
      ring: "ring-destructive/20",
      label: "Crítico",
      icon: AlertTriangle
    };
    if (kg < 5) return { 
      color: "text-amber-600 dark:text-amber-500", 
      bg: "bg-gradient-to-br from-amber-50/50 via-amber-50/30 to-amber-50/50 dark:from-amber-950/30 dark:via-amber-950/20 dark:to-amber-950/30",
      badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900",
      ring: "ring-amber-200/50 dark:ring-amber-800/30",
      label: "Bajo",
      icon: Gauge
    };
    return { 
      color: "text-emerald-600 dark:text-emerald-400", 
      bg: "bg-gradient-to-br from-emerald-50/50 via-emerald-50/30 to-emerald-50/50 dark:from-emerald-950/30 dark:via-emerald-950/20 dark:to-emerald-950/30",
      badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900",
      ring: "ring-emerald-200/50 dark:ring-emerald-800/30",
      label: "Óptimo",
      icon: Coffee
    };
  };

  return (
    <>
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm hover:shadow-md transition-shadow">
        <div className="p-4">
          <div className="flex items-center justify-between gap-4">
            {/* Hoppers - Horizontal Layout */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {primaryHoppers.map((hopper) => {
                const status = getStockStatus(hopper.current_kg);
                const StatusIcon = status.icon;
                
                return (
                  <div 
                    key={hopper.id} 
                    className={`group relative flex items-center gap-3 rounded-lg ${status.bg} border border-border/50 ring-1 ${status.ring} px-4 py-3 flex-1 min-w-0 transition-all duration-200 hover:scale-[1.02] hover:shadow-sm`}
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      <StatusIcon className={`w-5 h-5 ${status.color}`} />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          Tolva {hopper.hopper_number}
                        </span>
                        {hopper.current_kg < 2 && (
                          <AlertTriangle className="w-3 h-3 text-destructive animate-pulse" />
                        )}
                      </div>
                      <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                        {hopper.coffee_varieties.name}
                      </p>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className={`text-lg font-bold ${status.color}`}>
                          {hopper.current_kg.toFixed(1)}
                        </span>
                        <span className="text-xs text-muted-foreground">kg</span>
                        <Badge 
                          variant="outline"
                          className={`ml-1.5 ${status.badge} border text-xs px-1.5 py-0`}
                        >
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex gap-1.5 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConfigModalOpen(true)}
                className="gap-1.5 h-9 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Configurar</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(true)}
                className="gap-1 h-9 hover:bg-muted transition-colors"
              >
                <span className="hidden sm:inline">Ver todas</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <HopperManagementModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
      
      <HopperConfigModal
        open={isConfigModalOpen}
        onOpenChange={(open) => {
          console.log('HopperConfigModal onOpenChange called:', open);
          setIsConfigModalOpen(open);
        }}
      />
    </>
  );
}
