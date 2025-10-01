import React, { useState } from "react";
import { Plus, Edit2, Trash2, Coffee, Target, Clock, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCoffeeProfiles, useCreateCoffeeProfile } from "@/hooks/useCoffeeProfiles";
import { useGrinders } from "@/hooks/useGrinders";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CalibrationTemplatesProps {
  locationId?: string;
  tenantId?: string;
}

export function CalibrationTemplates({ locationId, tenantId }: CalibrationTemplatesProps) {
  const { toast } = useToast();

  const { data: coffeeProfiles = [], isLoading } = useCoffeeProfiles(locationId);
  const { data: grinders = [] } = useGrinders(locationId);
  const createProfile = useCreateCoffeeProfile();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    brew_method: "espresso",
    target_dose_g: 18,
    target_yield_unit: "g",
    target_time_min: 25,
    target_time_max: 32,
    target_ratio_min: 1.8,
    target_ratio_max: 2.2,
    target_temp_c: 93,
    grinder_id: "",
    tueste: "",
    lote: "",
    active: true,
  });

  const handleOpenDialog = (profile?: any) => {
    if (profile) {
      setEditingProfile(profile);
      setFormData({
        name: profile.name,
        brew_method: profile.brew_method,
        target_dose_g: profile.target_dose_g,
        target_yield_unit: profile.target_yield_unit,
        target_time_min: profile.target_time_min,
        target_time_max: profile.target_time_max,
        target_ratio_min: profile.target_ratio_min,
        target_ratio_max: profile.target_ratio_max,
        target_temp_c: profile.target_temp_c,
        grinder_id: profile.grinder_id || "",
        tueste: profile.tueste || "",
        lote: profile.lote || "",
        active: profile.active,
      });
    } else {
      setEditingProfile(null);
      setFormData({
        name: "",
        brew_method: "espresso",
        target_dose_g: 18,
        target_yield_unit: "g",
        target_time_min: 25,
        target_time_max: 32,
        target_ratio_min: 1.8,
        target_ratio_max: 2.2,
        target_temp_c: 93,
        grinder_id: "",
        tueste: "",
        lote: "",
        active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!locationId || !tenantId) {
      toast({
        title: "Error",
        description: "No se pudo obtener la ubicación del usuario",
        variant: "destructive",
      });
      return;
    }

    if (!formData.name) {
      toast({
        title: "Error",
        description: "El nombre del café es obligatorio",
        variant: "destructive",
      });
      return;
    }

    try {
      await createProfile.mutateAsync({
        ...formData,
        location_id: locationId,
        tenant_id: tenantId,
        grinder_id: formData.grinder_id || null,
      });

      toast({
        title: "Éxito",
        description: editingProfile ? "Perfil actualizado correctamente" : "Perfil creado correctamente",
      });

      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar el perfil",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Plantillas de Café</h2>
          <p className="text-sm text-muted-foreground">
            Gestiona los objetivos y parámetros de calibración para cada café
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Plantilla
        </Button>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Cargando plantillas...
        </div>
      ) : coffeeProfiles.length === 0 ? (
        <Card className="p-12 text-center">
          <Coffee className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No hay plantillas</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Crea tu primera plantilla de café para comenzar a calibrar
          </p>
          <Button onClick={() => handleOpenDialog()} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Crear Plantilla
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coffeeProfiles.map((profile) => {
            const grinder = grinders.find(g => g.id === profile.grinder_id);
            
            return (
              <Card key={profile.id} className={cn(
                "p-6 transition-all hover:shadow-md",
                !profile.active && "opacity-60"
              )}>
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{profile.name}</h3>
                    {profile.tueste && (
                      <Badge variant="outline" className="text-xs">
                        {profile.tueste}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDialog(profile)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Details */}
                <div className="space-y-3 text-sm">
                  {/* Grinder */}
                  {grinder && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Coffee className="h-4 w-4" />
                      <span>{grinder.name}</span>
                    </div>
                  )}

                  {/* Dose & Ratio */}
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Dosis:</span>
                    <span className="font-mono font-semibold">{profile.target_dose_g}g</span>
                    <span className="text-muted-foreground mx-1">→</span>
                    <span className="font-mono font-semibold">
                      {profile.target_ratio_min}–{profile.target_ratio_max}
                    </span>
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Tiempo:</span>
                    <span className="font-mono font-semibold">
                      {profile.target_time_min}–{profile.target_time_max}s
                    </span>
                  </div>

                  {/* Temperature */}
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Temperatura:</span>
                    <span className="font-mono font-semibold">{profile.target_temp_c}°C</span>
                  </div>

                  {/* Lote */}
                  {profile.lote && (
                    <div className="pt-2 border-t text-xs text-muted-foreground">
                      Lote: {profile.lote}
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Estado</span>
                    <Badge variant={profile.active ? "default" : "secondary"}>
                      {profile.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProfile ? "Editar Plantilla" : "Nueva Plantilla de Café"}
            </DialogTitle>
            <DialogDescription>
              Define los parámetros objetivo para la calibración de este café
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre del Café *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ej. Blend Casa, Colombia Supremo..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tueste">Tueste</Label>
                  <Input
                    id="tueste"
                    value={formData.tueste}
                    onChange={(e) => setFormData({ ...formData, tueste: e.target.value })}
                    placeholder="ej. Medio, Oscuro..."
                  />
                </div>
                <div>
                  <Label htmlFor="lote">Lote</Label>
                  <Input
                    id="lote"
                    value={formData.lote}
                    onChange={(e) => setFormData({ ...formData, lote: e.target.value })}
                    placeholder="ej. 2024-01"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="grinder">Molino</Label>
                <Select
                  value={formData.grinder_id}
                  onValueChange={(value) => setFormData({ ...formData, grinder_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar molino" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin asignar</SelectItem>
                    {grinders.map((grinder) => (
                      <SelectItem key={grinder.id} value={grinder.id}>
                        {grinder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Target Parameters */}
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-semibold">Parámetros Objetivo</h4>

              <div>
                <Label htmlFor="dose">Dosis (g)</Label>
                <Input
                  id="dose"
                  type="number"
                  step="0.1"
                  value={formData.target_dose_g}
                  onChange={(e) => setFormData({ ...formData, target_dose_g: parseFloat(e.target.value) })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ratio_min">Ratio Mínimo</Label>
                  <Input
                    id="ratio_min"
                    type="number"
                    step="0.1"
                    value={formData.target_ratio_min}
                    onChange={(e) => setFormData({ ...formData, target_ratio_min: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="ratio_max">Ratio Máximo</Label>
                  <Input
                    id="ratio_max"
                    type="number"
                    step="0.1"
                    value={formData.target_ratio_max}
                    onChange={(e) => setFormData({ ...formData, target_ratio_max: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="time_min">Tiempo Mín (s)</Label>
                  <Input
                    id="time_min"
                    type="number"
                    value={formData.target_time_min}
                    onChange={(e) => setFormData({ ...formData, target_time_min: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="time_max">Tiempo Máx (s)</Label>
                  <Input
                    id="time_max"
                    type="number"
                    value={formData.target_time_max}
                    onChange={(e) => setFormData({ ...formData, target_time_max: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="temp">Temperatura (°C)</Label>
                <Input
                  id="temp"
                  type="number"
                  step="0.5"
                  value={formData.target_temp_c}
                  onChange={(e) => setFormData({ ...formData, target_temp_c: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <Label htmlFor="active">Estado Activo</Label>
                <p className="text-xs text-muted-foreground">
                  Los perfiles activos aparecen en el selector de calibración
                </p>
              </div>
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createProfile.isPending}>
              {createProfile.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
