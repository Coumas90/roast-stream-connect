import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, GraduationCap, Plus } from "lucide-react";
import { useTrainingRequests, useTrainingEnabled } from "@/hooks/useTrainingRequests";
import { TrainingRequestModal } from "./TrainingRequestModal";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface TrainingWidgetProps {
  locationId: string;
}

export function TrainingWidget({ locationId }: TrainingWidgetProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: requests = [], isLoading } = useTrainingRequests(locationId);
  const { data: trainingEnabled = false } = useTrainingEnabled(locationId);

  if (!trainingEnabled) {
    return null; // Don't show widget if training is not enabled
  }

  const nextTraining = requests.find(r => r.status === 'scheduled' && r.scheduled_at);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
      case 'approved': return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      case 'scheduled': return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'completed': return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'approved': return 'Aprobada';
      case 'scheduled': return 'Programada';
      case 'completed': return 'Completada';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const getTrainingTypeText = (type: string) => {
    switch (type) {
      case 'barista_basics': return 'Fundamentos de Barista';
      case 'latte_art': return 'Latte Art';
      case 'coffee_cupping': return 'Catación de Café';
      case 'equipment_maintenance': return 'Mantenimiento de Equipos';
      case 'custom': return 'Personalizada';
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Capacitaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/50 hover:border-border transition-colors">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Capacitaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {nextTraining ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border/50">
                <CalendarDays className="h-4 w-4 text-primary mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {getTrainingTypeText(nextTraining.training_type)}
                    </span>
                    <Badge className={getStatusColor(nextTraining.status)}>
                      {getStatusText(nextTraining.status)}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(nextTraining.scheduled_at!), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                  </div>
                  {nextTraining.estimated_duration_hours && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Duración estimada: {nextTraining.estimated_duration_hours}h
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : pendingCount > 0 ? (
            <div className="text-center py-3">
              <div className="text-sm text-muted-foreground">
                {pendingCount} solicitud{pendingCount > 1 ? 'es' : ''} pendiente{pendingCount > 1 ? 's' : ''}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Esperando aprobación del equipo
              </div>
            </div>
          ) : (
            <div className="text-center py-3">
              <div className="text-sm text-muted-foreground">
                No hay capacitaciones programadas
              </div>
            </div>
          )}

          <Button 
            onClick={() => setIsModalOpen(true)}
            className="w-full"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            Solicitar Capacitación
          </Button>

          {requests.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <div className="text-xs text-muted-foreground">
                Total de solicitudes: {requests.length}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <TrainingRequestModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        locationId={locationId}
      />
    </>
  );
}