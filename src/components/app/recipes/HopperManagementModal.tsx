import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coffee, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import { useStockMetrics } from "@/hooks/useLocationStock";
import { useTenant } from "@/lib/tenant";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface HopperManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HopperManagementModal({
  open,
  onOpenChange,
}: HopperManagementModalProps) {
  const { locationId } = useTenant();
  const { stockItems, totalStock, isLoading } = useStockMetrics(locationId);

  const getStockStatus = (kg: number) => {
    if (kg === 0) return { 
      icon: XCircle, 
      color: "text-muted-foreground", 
      bg: "bg-muted", 
      label: "Vacía",
      variant: "secondary" as const
    };
    if (kg < 2) return { 
      icon: AlertTriangle, 
      color: "text-destructive", 
      bg: "bg-destructive/10", 
      label: "Crítico",
      variant: "destructive" as const
    };
    if (kg < 5) return { 
      icon: AlertTriangle, 
      color: "text-warning", 
      bg: "bg-warning/10", 
      label: "Bajo",
      variant: "outline" as const
    };
    return { 
      icon: CheckCircle, 
      color: "text-success", 
      bg: "bg-success/10", 
      label: "Bueno",
      variant: "default" as const
    };
  };

  const sortedHoppers = [...stockItems].sort((a, b) => a.hopper_number - b.hopper_number);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestión de Tolvas</DialogTitle>
          <DialogDescription>
            Estado actual de todas las tolvas de la ubicación
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <Coffee className="w-8 h-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Stock Total</p>
              <p className="text-2xl font-bold text-foreground">{totalStock.toFixed(1)} kg</p>
            </div>
            <div className="ml-auto">
              <p className="text-sm text-muted-foreground">Tolvas Activas</p>
              <p className="text-2xl font-bold text-foreground">
                {stockItems.filter(h => h.current_kg > 0).length} / {stockItems.length}
              </p>
            </div>
          </div>

          {/* Hoppers List */}
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : sortedHoppers.length > 0 ? (
            <div className="grid gap-4">
              {sortedHoppers.map((hopper) => {
                const status = getStockStatus(hopper.current_kg);
                const StatusIcon = status.icon;

                return (
                  <Card key={hopper.id} className="border-2">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Hopper Number */}
                        <div className={`flex-shrink-0 w-16 h-16 rounded-lg ${status.bg} flex items-center justify-center`}>
                          <div className="text-center">
                            <Coffee className={`w-6 h-6 ${status.color} mx-auto mb-1`} />
                            <p className="text-xs font-medium text-foreground">
                              #{hopper.hopper_number}
                            </p>
                          </div>
                        </div>

                        {/* Hopper Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-foreground truncate">
                                {hopper.coffee_varieties.name}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {hopper.coffee_varieties.category}
                              </p>
                            </div>
                            <Badge variant={status.variant}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {status.label}
                            </Badge>
                          </div>

                          {/* Stock Info */}
                          <div className="grid grid-cols-2 gap-4 mt-3">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Stock Actual</p>
                              <p className={`text-lg font-bold ${status.color}`}>
                                {hopper.current_kg.toFixed(2)} kg
                              </p>
                            </div>
                            {hopper.last_refill_at && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Última Recarga
                                </p>
                                <p className="text-sm font-medium text-foreground">
                                  {format(new Date(hopper.last_refill_at), "dd MMM, HH:mm", { locale: es })}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Notes */}
                          {hopper.notes && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <p className="text-xs text-muted-foreground">{hopper.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Coffee className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No hay tolvas configuradas</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
