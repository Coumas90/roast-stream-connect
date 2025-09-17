import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, RefreshCw } from "lucide-react";

interface TrainingFiltersProps {
  onSearchChange: (value: string) => void;
  onStatusFilter: (status: string) => void;
  onTypeFilter: (type: string) => void;
  onPriorityFilter: (priority: string) => void;
  onRefresh: () => void;
  searchValue: string;
  statusFilter: string;
  typeFilter: string;
  priorityFilter: string;
}

export function TrainingFilters({
  onSearchChange,
  onStatusFilter,
  onTypeFilter,
  onPriorityFilter,
  onRefresh,
  searchValue,
  statusFilter,
  typeFilter,
  priorityFilter,
}: TrainingFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      <div className="flex flex-col sm:flex-row gap-3 flex-1">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar solicitudes..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={onStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="approved">Aprobado</SelectItem>
            <SelectItem value="scheduled">Programado</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={onTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="barista_basics">Fundamentos</SelectItem>
            <SelectItem value="latte_art">Arte Latte</SelectItem>
            <SelectItem value="coffee_cupping">Catación</SelectItem>
            <SelectItem value="equipment_maintenance">Mantenimiento</SelectItem>
            <SelectItem value="custom">Personalizada</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={onPriorityFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="low">Baja</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="urgent">Urgente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button onClick={onRefresh} variant="outline" size="sm">
        <RefreshCw className="h-4 w-4 mr-2" />
        Actualizar
      </Button>
    </div>
  );
}