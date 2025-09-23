import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrainingKanbanCard } from "./TrainingKanbanCard";
import { TrainingRequest } from "@/hooks/useTrainingRequests";

interface Column {
  id: string;
  title: string;
  className: string;
}

interface TrainingKanbanColumnProps {
  column: Column;
  requests: TrainingRequest[];
  isDraggedOver: boolean;
  onDragStart: (request: TrainingRequest) => void;
  onDragEnd: () => void;
  onDragOver: (columnId: string) => void;
  onDragLeave: () => void;
  onDrop: (columnId: string) => void;
  onSchedule: (request: TrainingRequest) => void;
}

export function TrainingKanbanColumn({
  column,
  requests,
  isDraggedOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onSchedule,
}: TrainingKanbanColumnProps) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    onDragOver(column.id);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      onDragLeave();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop(column.id);
  };

  return (
    <Card 
      className={`min-w-80 transition-colors ${column.className} ${
        isDraggedOver ? "ring-2 ring-primary" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          {column.title}
          <span className="bg-background text-foreground px-2 py-1 rounded-full text-xs">
            {requests.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
        {requests.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            No hay solicitudes
          </p>
        ) : (
          requests.map((request) => (
            <TrainingKanbanCard
              key={request.id}
              request={request}
              isDragged={false}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onSchedule={onSchedule}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}