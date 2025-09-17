import React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Clock, CheckCircle, Calendar, XCircle } from "lucide-react";
import { TrainingRequest } from "@/hooks/useTrainingRequests";

interface TrainingRequestsTableProps {
  requests: TrainingRequest[];
  onStatusChange: (id: string, status: string) => void;
  onSchedule: (request: TrainingRequest) => void;
}

const statusConfig = {
  pending: { label: "Pendiente", variant: "secondary" as const, icon: Clock },
  approved: { label: "Aprobado", variant: "default" as const, icon: CheckCircle },
  scheduled: { label: "Programado", variant: "outline" as const, icon: Calendar },
  completed: { label: "Completado", variant: "success" as const, icon: CheckCircle },
  cancelled: { label: "Cancelado", variant: "destructive" as const, icon: XCircle },
};

const priorityConfig = {
  low: { label: "Baja", variant: "secondary" as const },
  medium: { label: "Media", variant: "default" as const },
  high: { label: "Alta", variant: "outline" as const },
  urgent: { label: "Urgente", variant: "destructive" as const },
};

const trainingTypeLabels = {
  barista_basics: "Fundamentos de Barista",
  latte_art: "Arte Latte",
  coffee_cupping: "Catación de Café",
  equipment_maintenance: "Mantenimiento de Equipos",
  custom: "Personalizada",
};

export function TrainingRequestsTable({ requests, onStatusChange, onSchedule }: TrainingRequestsTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Ubicación</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Prioridad</TableHead>
            <TableHead>Solicitado</TableHead>
            <TableHead>Fecha Preferida</TableHead>
            <TableHead>Duración</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                No hay solicitudes de capacitación
              </TableCell>
            </TableRow>
          ) : (
            requests.map((request) => {
              const status = statusConfig[request.status];
              const priority = priorityConfig[request.priority];
              const StatusIcon = status.icon;

              return (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">
                    {trainingTypeLabels[request.training_type]}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {request.locations?.name || 'Sin nombre'}
                      </span>
                      {request.locations?.code && (
                        <span className="text-sm text-muted-foreground">
                          {request.locations.code}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant} className="flex items-center gap-1 w-fit">
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={priority.variant}>
                      {priority.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(request.created_at), "dd MMM yyyy", { locale: es })}
                  </TableCell>
                  <TableCell>
                    {request.preferred_date 
                      ? format(new Date(request.preferred_date), "dd MMM yyyy", { locale: es })
                      : "-"
                    }
                  </TableCell>
                  <TableCell>
                    {request.estimated_duration_hours}h ({request.estimated_days}d)
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {request.status === 'pending' && (
                          <>
                            <DropdownMenuItem onClick={() => onStatusChange(request.id, 'approved')}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Aprobar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onStatusChange(request.id, 'cancelled')}>
                              <XCircle className="mr-2 h-4 w-4" />
                              Rechazar
                            </DropdownMenuItem>
                          </>
                        )}
                        {request.status === 'approved' && (
                          <DropdownMenuItem onClick={() => onSchedule(request)}>
                            <Calendar className="mr-2 h-4 w-4" />
                            Programar
                          </DropdownMenuItem>
                        )}
                        {request.status === 'scheduled' && (
                          <DropdownMenuItem onClick={() => onStatusChange(request.id, 'completed')}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Marcar Completado
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onStatusChange(request.id, 'cancelled')}>
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancelar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}