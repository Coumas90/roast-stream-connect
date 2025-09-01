import React, { useState } from "react";
import { MapPin, Coffee, Plus, Edit } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/layouts/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const stockSchema = z.object({
  location_id: z.string().min(1, "Selecciona una ubicación"),
  coffee_variety_id: z.string().min(1, "Selecciona una variedad"),
  hopper_number: z.number().min(1).max(4),
  current_kg: z.number().min(0),
  notes: z.string().optional(),
});

type StockForm = z.infer<typeof stockSchema>;

export default function LocationStockAdmin() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<StockForm>({
    resolver: zodResolver(stockSchema),
    defaultValues: {
      hopper_number: 1,
      current_kg: 0,
    },
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, tenant_id")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: coffeeVarieties } = useQuery({
    queryKey: ["coffee-varieties-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coffee_varieties")
        .select("id, name, category")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: stockData, isLoading } = useQuery({
    queryKey: ["location-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location_stock")
        .select(`
          *,
          locations(name),
          coffee_varieties(name, category)
        `)
        .order("location_id")
        .order("hopper_number");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: StockForm) => {
      const { error } = await supabase
        .from("location_stock")
        .insert({ ...data, last_refill_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["location-stock"] });
      toast({ title: "Stock actualizado exitosamente" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({ title: "Error al actualizar stock", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: StockForm }) => {
      const { error } = await supabase
        .from("location_stock")
        .update({ ...data, last_refill_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["location-stock"] });
      toast({ title: "Stock actualizado exitosamente" });
      setDialogOpen(false);
      setEditingStock(null);
      form.reset();
    },
    onError: (error) => {
      toast({ title: "Error al actualizar stock", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (stock: any) => {
    setEditingStock(stock);
    form.reset({
      location_id: stock.location_id,
      coffee_variety_id: stock.coffee_variety_id,
      hopper_number: stock.hopper_number,
      current_kg: stock.current_kg,
      notes: stock.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (data: StockForm) => {
    if (editingStock) {
      updateMutation.mutate({ id: editingStock.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingStock(null);
    form.reset();
  };

  const groupedStock = stockData?.reduce((acc, stock) => {
    const locationName = stock.locations?.name || "Sin nombre";
    if (!acc[locationName]) {
      acc[locationName] = [];
    }
    acc[locationName].push(stock);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Stock por Ubicación</h1>
            <p className="text-muted-foreground">
              Gestiona el stock actual de café en las tolvas de cada ubicación
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Actualizar Stock
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingStock ? "Editar Stock" : "Actualizar Stock de Tolva"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="location_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ubicación</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar ubicación" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {locations?.map((location) => (
                              <SelectItem key={location.id} value={location.id}>
                                {location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hopper_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de Tolva</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar tolva" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[1, 2, 3, 4].map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                Tolva {num}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="coffee_variety_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Variedad de Café</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar variedad" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {coffeeVarieties?.map((variety) => (
                              <SelectItem key={variety.id} value={variety.id}>
                                {variety.name} ({variety.category === "tupa" ? "TUPÁ" : "Otro"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="current_kg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cantidad (kg)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="0.0"
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            value={field.value}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notas (opcional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Observaciones..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                      {editingStock ? "Actualizar" : "Guardar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stock by Location */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="text-center py-8">Cargando stock...</div>
          ) : (
            Object.entries(groupedStock || {}).map(([locationName, stocks]) => (
              <Card key={locationName}>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MapPin className="mr-2 h-5 w-5" />
                    {locationName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tolva</TableHead>
                        <TableHead>Variedad</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Stock (kg)</TableHead>
                        <TableHead>Último Llenado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stocks.map((stock) => (
                        <TableRow key={stock.id}>
                          <TableCell className="font-medium">Tolva {stock.hopper_number}</TableCell>
                          <TableCell>{stock.coffee_varieties?.name}</TableCell>
                          <TableCell>
                            <Badge variant={stock.coffee_varieties?.category === "tupa" ? "default" : "secondary"}>
                              {stock.coffee_varieties?.category === "tupa" ? "TUPÁ" : "Otro"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={stock.current_kg > 5 ? "default" : stock.current_kg > 2 ? "secondary" : "destructive"}>
                              {stock.current_kg} kg
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {stock.last_refill_at 
                              ? new Date(stock.last_refill_at).toLocaleDateString()
                              : "-"
                            }
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(stock)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {stocks.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                            No hay stock registrado para esta ubicación
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}