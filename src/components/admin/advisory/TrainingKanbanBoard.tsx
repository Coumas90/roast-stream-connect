import React from "react";
import { TrainingKanbanColumn } from "./TrainingKanbanColumn";
import { TrainingRequest } from "@/hooks/useTrainingRequests";

interface TrainingKanbanBoardProps {
  requests: TrainingRequest[];
  onStatusChange: (id: string, status: string) => void;
  onSchedule: (request: TrainingRequest) => void;
}

const COLUMNS = [
  { id: "pending", title: "Pendiente", className: "bg-yellow-50 border-yellow-200" },
  { id: "approved", title: "Aprobado", className: "bg-blue-50 border-blue-200" },
  { id: "scheduled", title: "Programado", className: "bg-purple-50 border-purple-200" },
  { id: "completed", title: "Completado", className: "bg-green-50 border-green-200" },
  { id: "cancelled", title: "Cancelado", className: "bg-red-50 border-red-200" },
];

export function TrainingKanbanBoard({ 
  requests, 
  onStatusChange, 
  onSchedule 
}: TrainingKanbanBoardProps) {
  const [draggedRequest, setDraggedRequest] = React.useState<TrainingRequest | null>(null);
  const [draggedOverColumn, setDraggedOverColumn] = React.useState<string | null>(null);

  // Group requests by status
  const requestsByStatus = React.useMemo(() => {
    return requests.reduce((acc, request) => {
      const status = request.status || "pending";
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(request);
      return acc;
    }, {} as Record<string, TrainingRequest[]>);
  }, [requests]);

  const handleDragStart = (request: TrainingRequest) => {
    setDraggedRequest(request);
  };

  const handleDragEnd = () => {
    setDraggedRequest(null);
    setDraggedOverColumn(null);
  };

  const handleDragOver = (columnId: string) => {
    setDraggedOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDraggedOverColumn(null);
  };

  const handleDrop = (newStatus: string) => {
    if (draggedRequest && draggedRequest.status !== newStatus) {
      // Validate status transitions
      const currentStatus = draggedRequest.status;
      const validTransitions: Record<string, string[]> = {
        pending: ["approved", "cancelled"],
        approved: ["scheduled", "cancelled"],
        scheduled: ["completed", "cancelled"],
        completed: [],
        cancelled: [],
      };

      if (validTransitions[currentStatus]?.includes(newStatus)) {
        onStatusChange(draggedRequest.id, newStatus);
      }
    }
    setDraggedOverColumn(null);
  };

  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {COLUMNS.map((column) => (
        <TrainingKanbanColumn
          key={column.id}
          column={column}
          requests={requestsByStatus[column.id] || []}
          isDraggedOver={draggedOverColumn === column.id}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onSchedule={onSchedule}
        />
      ))}
    </div>
  );
}