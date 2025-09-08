import React, { useState } from "react";
import { Plus, Search, Coffee, Grid, List, Trash2, Edit } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/layouts/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/coffee/ImageUpload";
import { TastingForm } from "@/components/coffee/TastingForm";
import { CoffeeCard } from "@/components/coffee/CoffeeCard";
import { CoffeeDetailModal } from "@/components/coffee/CoffeeDetailModal";

const coffeeVarietySchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  origin: z.string().optional(),
  category: z.enum(["tupa", "other"]),
  price_per_kg: z.number().positive().optional(),
  active: z.boolean(),
  available_bulk: z.boolean(),
  available_packaged: z.boolean(),
  image_url: z.string().optional(),
  specifications: z.object({
    tasting: z.object({
      sweetness: z.number().min(0).max(10).optional(),
      aroma: z.number().min(0).max(10).optional(),
      flavor: z.number().min(0).max(10).optional(),
      aftertaste: z.number().min(0).max(10).optional(),
      acidity: z.number().min(0).max(10).optional(),
      body: z.number().min(0).max(10).optional(),
      balance: z.number().min(0).max(10).optional(),
      overall: z.number().min(0).max(10).optional(),
      uniformity: z.number().min(0).max(10).optional(),
      clean_cup: z.number().min(0).max(10).optional(),
      defects: z.number().min(0).max(10).optional(),
      notes: z.string().optional(),
    }).optional(),
    technical: z.object({
      region: z.string().optional(),
      varietal: z.string().optional(),
      process: z.string().optional(),
      altitude: z.number().optional(),
      score: z.number().min(0).max(100).optional(),
      harvest: z.string().optional(),
      practices: z.string().optional(),
    }).optional(),
  }).optional(),
});

type VarietyForm = z.infer<typeof coffeeVarietySchema>;

export default function CoffeeVarietiesAdmin() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVariety, setEditingVariety] = useState<any>(null);
  const [detailVariety, setDetailVariety] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<VarietyForm>({
    resolver: zodResolver(coffeeVarietySchema),
    defaultValues: {
      category: "other",
      active: true,
      available_bulk: true,
      available_packaged: true,
      specifications: {
        tasting: {},
        technical: {},
      },
    },
  });

  const { data: varieties, isLoading } = useQuery({
    queryKey: ["coffee-varieties", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("coffee_varieties")
        .select("*")
        .order("created_at", { ascending: false });

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,origin.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: VarietyForm) => {
      const { error } = await supabase
        .from("coffee_varieties")
        .insert({
          name: data.name,
          origin: data.origin,
          description: data.description,
          category: data.category,
          price_per_kg: data.price_per_kg,
          image_url: data.image_url,
          specifications: data.specifications || {},
          active: data.active ?? true,
          available_bulk: data.available_bulk ?? true,
          available_packaged: data.available_packaged ?? true
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coffee-varieties"] });
      toast({ title: "Variedad creada exitosamente" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({ title: "Error al crear variedad", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: VarietyForm }) => {
      const { error } = await supabase
        .from("coffee_varieties")
        .update({
          name: data.name,
          origin: data.origin,
          description: data.description,
          category: data.category,
          price_per_kg: data.price_per_kg,
          image_url: data.image_url,
          specifications: data.specifications || {},
          active: data.active ?? true,
          available_bulk: data.available_bulk ?? true,
          available_packaged: data.available_packaged ?? true
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coffee-varieties"] });
      toast({ title: "Variedad actualizada exitosamente" });
      setDialogOpen(false);
      setEditingVariety(null);
      form.reset();
    },
    onError: (error) => {
      toast({ title: "Error al actualizar variedad", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("coffee_varieties")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coffee-varieties"] });
      toast({ title: "Variedad eliminada exitosamente" });
    },
    onError: (error) => {
      toast({ title: "Error al eliminar variedad", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (variety: any) => {
    setEditingVariety(variety);
    const specs = variety.specifications ? (typeof variety.specifications === 'string' ? JSON.parse(variety.specifications) : variety.specifications) : { tasting: {}, technical: {} };
    form.reset({
      name: variety.name,
      description: variety.description || "",
      origin: variety.origin || "",
      category: variety.category,
      price_per_kg: variety.price_per_kg || undefined,
      active: variety.active,
      available_bulk: variety.available_bulk ?? true,
      available_packaged: variety.available_packaged ?? true,
      image_url: variety.image_url || "",
      specifications: specs,
    });
    setDialogOpen(true);
  };

  const handleView = (variety: any) => {
    setDetailVariety(variety);
    setDetailModalOpen(true);
  };

  const handleSubmit = (data: VarietyForm) => {
    if (editingVariety) {
      updateMutation.mutate({ id: editingVariety.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingVariety(null);
    form.reset();
  };

  return (
    <div>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Variedades de Café</h1>
            <p className="text-muted-foreground">
              Gestiona el catálogo de variedades de café disponibles
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Variedad
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingVariety ? "Editar Variedad" : "Nueva Variedad de Café"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="basic">Información Básica</TabsTrigger>
                      <TabsTrigger value="image">Imagen</TabsTrigger>
                      <TabsTrigger value="tasting">Análisis y Cata</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="basic" className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nombre</FormLabel>
                              <FormControl>
                                <Input placeholder="Ej: Café Supremo" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Categoría</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar categoría" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="tupa">TUPÁ</SelectItem>
                                  <SelectItem value="other">Otro Proveedor</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descripción</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Descripción de la variedad..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="origin"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Origen</FormLabel>
                              <FormControl>
                                <Input placeholder="Ej: Colombia" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="price_per_kg"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Precio por kg (opcional)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                  value={field.value || ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="active"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Activa</FormLabel>
                              <div className="text-sm text-muted-foreground">
                                La variedad estará disponible para pedidos
                              </div>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="available_bulk"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Disponible por Kg</FormLabel>
                                <div className="text-sm text-muted-foreground">
                                  Para pedidos de café molido a granel
                                </div>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="available_packaged"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Disponible en Cuartitos</FormLabel>
                                <div className="text-sm text-muted-foreground">
                                  Para productos empacados individuales
                                </div>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="image" className="space-y-4">
                      <FormField
                        control={form.control}
                        name="image_url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Imagen del Café</FormLabel>
                            <FormControl>
                              <ImageUpload
                                value={field.value}
                                onChange={field.onChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>

                    <TabsContent value="tasting" className="space-y-4">
                      <TastingForm control={form.control} />
                    </TabsContent>
                  </Tabs>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                      {editingVariety ? "Actualizar" : "Crear"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and View Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar variedades..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Varieties Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Coffee className="mr-2 h-5 w-5" />
              Variedades Registradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Cargando variedades...</div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {varieties?.map((variety) => (
                  <CoffeeCard
                    key={variety.id}
                    variety={variety}
                    onEdit={handleEdit}
                    onView={handleView}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
                {varieties?.length === 0 && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No se encontraron variedades
                  </div>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Precio/kg</TableHead>
                    <TableHead>Puntaje</TableHead>
                    <TableHead>Disponibilidad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {varieties?.map((variety) => (
                    <TableRow key={variety.id}>
                      <TableCell className="font-medium">{variety.name}</TableCell>
                      <TableCell>
                        <Badge variant={variety.category === "tupa" ? "default" : "secondary"}>
                          {variety.category === "tupa" ? "TUPÁ" : "Otro"}
                        </Badge>
                      </TableCell>
                      <TableCell>{variety.origin || "-"}</TableCell>
                      <TableCell>
                        {variety.price_per_kg ? `$${variety.price_per_kg}` : "-"}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const specs = variety.specifications ? (typeof variety.specifications === 'string' ? JSON.parse(variety.specifications) : variety.specifications) : {};
                          return specs?.technical?.score ? `${specs.technical.score}/100` : "-";
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {variety.available_bulk && (
                            <Badge variant="outline" className="text-xs">
                              📦 Por Kg
                            </Badge>
                          )}
                          {variety.available_packaged && (
                            <Badge variant="outline" className="text-xs">
                              📄 Cuartitos
                            </Badge>
                          )}
                          {!variety.available_bulk && !variety.available_packaged && (
                            <Badge variant="destructive" className="text-xs">
                              Sin disponibilidad
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={variety.active ? "default" : "destructive"}>
                          {variety.active ? "Activa" : "Inactiva"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleView(variety)}
                          >
                            <Coffee className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(variety)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteMutation.mutate(variety.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {varieties?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No se encontraron variedades
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detail Modal */}
        <CoffeeDetailModal
          variety={detailVariety}
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
        />
      </div>
    </div>
  );
}