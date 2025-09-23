import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TrainingRequest } from "@/hooks/useTrainingRequests";

interface TrainingKanbanCardProps {
  request: TrainingRequest;
  isDragged: boolean;
  onDragStart: (request: TrainingRequest) => void;
  onDragEnd: () => void;
  onSchedule: (request: TrainingRequest) => void;
}

const priorityConfig = {
  low: { label: "Baja", variant: "secondary" as const },
  medium: { label: "Media", variant: "default" as const },
  high: { label: "Alta", variant: "destructive" as const },
  urgent: { label: "Urgente", variant: "destructive" as const },
};

const trainingTypeLabels = {
  barista_basics: "Fundamentos de Barista",
  latte_art: "Arte en Leche",
  coffee_cupping: "Catación",
  equipment_maintenance: "Mantenimiento de Equipos",
  customer_service: "Atención al Cliente",
  inventory_management: "Gestión de Inventario",
  other: "Otro",
};

export function TrainingKanbanCard({
  request,
  isDragged,
  onDragStart,
  onDragEnd,
  onSchedule,
}: TrainingKanbanCardProps) {
  const priority = priorityConfig[request.priority as keyof typeof priorityConfig] || priorityConfig.medium;
  const typeLabel = trainingTypeLabels[request.training_type as keyof typeof trainingTypeLabels] || request.training_type;

  const handleDragStart = (e: React.DragEvent) => {
    onDragStart(request);
  };

  return (
    <Card 
      className={`cursor-move transition-all hover:shadow-md ${
        isDragged ? "opacity-50 transform rotate-2" : ""
      }`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <h4 className="font-medium text-sm leading-tight">{typeLabel}</h4>
          <Badge variant={priority.variant} className="text-xs">
            {priority.label}
          </Badge>
        </div>

        <div className="flex items-center text-xs text-muted-foreground">
          <MapPin className="w-3 h-3 mr-1" />
          <span className="truncate">{request.locations?.name}</span>
        </div>

        <div className="flex items-center text-xs text-muted-foreground">
          <Calendar className="w-3 h-3 mr-1" />
          <span>
            {format(new Date(request.created_at), "dd MMM yyyy", { locale: es })}
          </span>
        </div>

        {request.preferred_date && (
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="w-3 h-3 mr-1" />
            <span>
              Prefiere: {format(new Date(request.preferred_date), "dd MMM", { locale: es })}
            </span>
          </div>
        )}


        {request.requested_by && (
          <div className="flex items-center text-xs text-muted-foreground">
            <User className="w-3 h-3 mr-1" />
            <span className="truncate">{request.requested_by}</span>
          </div>
        )}

        {request.notes && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {request.notes.length > 60 ? `${request.notes.substring(0, 60)}...` : request.notes}
          </p>
        )}

        {request.status === "approved" && (
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onSchedule(request);
            }}
          >
            Programar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}