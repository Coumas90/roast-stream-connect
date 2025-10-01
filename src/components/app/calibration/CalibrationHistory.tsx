import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Download, Filter, Search, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useCalibrationEntries } from "@/hooks/useCalibrationEntries";
import { useCoffeeProfiles } from "@/hooks/useCoffeeProfiles";
import { cn } from "@/lib/utils";

interface CalibrationHistoryProps {
  locationId?: string;
}

export function CalibrationHistory({ locationId }: CalibrationHistoryProps) {
  
  const [searchQuery, setSearchQuery] = useState("");
  const [coffeeFilter, setCoffeeFilter] = useState<string>("all");
  const [turnoFilter, setTurnoFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const { data: coffeeProfiles = [] } = useCoffeeProfiles(locationId);
  const { data: entries = [], isLoading } = useCalibrationEntries(
    coffeeFilter === "all" ? undefined : coffeeFilter
  );

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // Search filter
      if (searchQuery && !entry.notes_text?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Turno filter
      if (turnoFilter !== "all" && entry.turno !== turnoFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === "approved" && !entry.approved) {
        return false;
      }
      if (statusFilter === "pending" && entry.approved) {
        return false;
      }

      // Date filter
      if (dateFilter !== "all") {
        const entryDate = new Date(entry.fecha);
        const today = new Date();
        const daysDiff = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (dateFilter === "today" && daysDiff !== 0) return false;
        if (dateFilter === "week" && daysDiff > 7) return false;
        if (dateFilter === "month" && daysDiff > 30) return false;
      }

      return true;
    });
  }, [entries, searchQuery, turnoFilter, statusFilter, dateFilter]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ["Fecha", "Turno", "Café", "Dosis (g)", "Rendimiento", "Tiempo (s)", "Temp (°C)", "Molienda", "Ratio", "Estado", "Notas"];
    
    const rows = filteredEntries.map(entry => [
      format(new Date(entry.fecha), "dd/MM/yyyy"),
      entry.turno,
      coffeeProfiles.find(p => p.id === entry.coffee_profile_id)?.name || "N/A",
      entry.dose_g,
      `${entry.yield_value}${entry.yield_unit}`,
      entry.time_s,
      entry.temp_c,
      entry.grind_points,
      entry.ratio_calc?.toFixed(2) || "N/A",
      entry.approved ? "Aprobado" : "Pendiente",
      entry.notes_text || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `calibraciones_${format(new Date(), "yyyyMMdd")}.csv`;
    link.click();
  };

  const getSemaphoreColor = (entry: any) => {
    const profile = coffeeProfiles.find(p => p.id === entry.coffee_profile_id);
    if (!profile) return "muted";

    const timeOk = entry.time_s >= profile.target_time_min && entry.time_s <= profile.target_time_max;
    const ratioOk = entry.ratio_calc && 
      entry.ratio_calc >= profile.target_ratio_min && 
      entry.ratio_calc <= profile.target_ratio_max;

    if (timeOk && ratioOk) return "success";
    if (!timeOk || !ratioOk) return "warning";
    return "destructive";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Historial de Calibraciones</h2>
          <p className="text-sm text-muted-foreground">
            Registro completo de todas las calibraciones realizadas
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar en notas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Coffee Filter */}
          <Select value={coffeeFilter} onValueChange={setCoffeeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Café" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los cafés</SelectItem>
              {coffeeProfiles.map(profile => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Turno Filter */}
          <Select value={turnoFilter} onValueChange={setTurnoFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Turno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los turnos</SelectItem>
              <SelectItem value="mañana">Mañana</SelectItem>
              <SelectItem value="tarde">Tarde</SelectItem>
              <SelectItem value="noche">Noche</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="approved">Aprobados</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Filter */}
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el historial</SelectItem>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{filteredEntries.length}</div>
          <div className="text-sm text-muted-foreground">Total</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">
            {filteredEntries.filter(e => e.approved).length}
          </div>
          <div className="text-sm text-muted-foreground">Aprobadas</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-amber-600">
            {filteredEntries.filter(e => !e.approved).length}
          </div>
          <div className="text-sm text-muted-foreground">Pendientes</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-600">
            {new Set(filteredEntries.map(e => e.fecha)).size}
          </div>
          <div className="text-sm text-muted-foreground">Días únicos</div>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px]">Fecha</TableHead>
                <TableHead className="min-w-[80px]">Turno</TableHead>
                <TableHead className="min-w-[150px]">Café</TableHead>
                <TableHead className="text-right">Dosis</TableHead>
                <TableHead className="text-right">Rend.</TableHead>
                <TableHead className="text-right">Tiempo</TableHead>
                <TableHead className="text-right">Temp</TableHead>
                <TableHead className="text-right">Molienda</TableHead>
                <TableHead className="text-right">Ratio</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="min-w-[200px]">Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    Cargando historial...
                  </TableCell>
                </TableRow>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    No se encontraron calibraciones con los filtros seleccionados
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => {
                  const profile = coffeeProfiles.find(p => p.id === entry.coffee_profile_id);
                  const semaphoreColor = getSemaphoreColor(entry);
                  
                  return (
                    <TableRow key={entry.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {format(new Date(entry.fecha), "dd MMM yyyy", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {entry.turno}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {profile?.name || "N/A"}
                      </TableCell>
                      <TableCell className="text-right">{entry.dose_g}g</TableCell>
                      <TableCell className="text-right">
                        {entry.yield_value}{entry.yield_unit}
                      </TableCell>
                      <TableCell className="text-right">{entry.time_s}s</TableCell>
                      <TableCell className="text-right">{entry.temp_c}°C</TableCell>
                      <TableCell className="text-right">{entry.grind_points}</TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={cn(
                          "px-2 py-1 rounded text-sm",
                          semaphoreColor === "success" && "bg-green-500/10 text-green-700",
                          semaphoreColor === "warning" && "bg-amber-500/10 text-amber-700",
                          semaphoreColor === "destructive" && "bg-red-500/10 text-red-700"
                        )}>
                          {entry.ratio_calc?.toFixed(2) || "N/A"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {entry.approved ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <Clock className="h-5 w-5 text-amber-600 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {entry.notes_text || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
