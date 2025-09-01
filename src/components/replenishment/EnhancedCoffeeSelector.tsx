import React, { useState } from "react";
import { Plus, Minus, Coffee, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface OrderItem {
  coffee_variety_id: string;
  quantity_kg: number;
  variety_name: string;
  category: string;
  price_per_kg?: number;
  notes?: string;
}

interface EnhancedCoffeeSelectorProps {
  locationId: string;
  selectedItems: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
}

export function EnhancedCoffeeSelector({ locationId, selectedItems, onItemsChange }: EnhancedCoffeeSelectorProps) {
  const [expandedCategory, setExpandedCategory] = useState<string>("tupa");

  const { data: coffeeVarieties, isLoading } = useQuery({
    queryKey: ["coffee-varieties-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coffee_varieties")
        .select("*")
        .eq("active", true)
        .order("category")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: currentStock } = useQuery({
    queryKey: ["location-stock", locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location_stock")
        .select(`
          *,
          coffee_varieties(name, category)
        `)
        .eq("location_id", locationId);
      if (error) throw error;
      return data;
    },
    enabled: !!locationId,
  });

  const groupedVarieties = coffeeVarieties?.reduce((acc, variety) => {
    if (!acc[variety.category]) {
      acc[variety.category] = [];
    }
    acc[variety.category].push(variety);
    return acc;
  }, {} as Record<string, any[]>);

  const addItem = (variety: any) => {
    const existingItem = selectedItems.find(item => item.coffee_variety_id === variety.id);
    if (existingItem) {
      updateQuantity(variety.id, existingItem.quantity_kg + 1);
    } else {
      const newItem: OrderItem = {
        coffee_variety_id: variety.id,
        quantity_kg: 1,
        variety_name: variety.name,
        category: variety.category,
        price_per_kg: variety.price_per_kg,
      };
      onItemsChange([...selectedItems, newItem]);
    }
  };

  const updateQuantity = (varietyId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(varietyId);
      return;
    }
    
    const updatedItems = selectedItems.map(item =>
      item.coffee_variety_id === varietyId
        ? { ...item, quantity_kg: newQuantity }
        : item
    );
    onItemsChange(updatedItems);
  };

  const removeItem = (varietyId: string) => {
    const updatedItems = selectedItems.filter(item => item.coffee_variety_id !== varietyId);
    onItemsChange(updatedItems);
  };

  const getStockForVariety = (varietyId: string) => {
    return currentStock?.filter(stock => stock.coffee_variety_id === varietyId) || [];
  };

  const getTotalStock = (varietyId: string) => {
    const stocks = getStockForVariety(varietyId);
    return stocks.reduce((total, stock) => total + stock.current_kg, 0);
  };

  const getSelectedQuantity = (varietyId: string) => {
    const item = selectedItems.find(item => item.coffee_variety_id === varietyId);
    return item?.quantity_kg || 0;
  };

  const calculateTotal = () => {
    return selectedItems.reduce((total, item) => {
      if (item.price_per_kg) {
        return total + (item.quantity_kg * item.price_per_kg);
      }
      return total;
    }, 0);
  };

  if (isLoading) {
    return <div className="text-center py-8">Cargando variedades de café...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Current Stock Display */}
      {currentStock && currentStock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Coffee className="mr-2 h-5 w-5" />
              Stock Actual en Tolvas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {currentStock.map((stock) => (
                <div key={stock.id} className="p-3 border rounded-lg">
                  <div className="font-medium">Tolva {stock.hopper_number}</div>
                  <div className="text-sm text-muted-foreground">{stock.coffee_varieties?.name}</div>
                  <Badge 
                    variant={stock.current_kg > 5 ? "default" : stock.current_kg > 2 ? "secondary" : "destructive"}
                    className="mt-1"
                  >
                    {stock.current_kg} kg
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coffee Varieties Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Variedades para Pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(groupedVarieties || {}).map(([category, varieties]) => (
            <div key={category}>
              <Button
                variant="ghost"
                onClick={() => setExpandedCategory(expandedCategory === category ? "" : category)}
                className="w-full justify-between p-0 h-auto"
              >
                <h3 className="text-lg font-semibold">
                  {category === "tupa" ? "Café TUPÁ" : "Otros Proveedores"}
                </h3>
                <Badge variant="outline">{varieties.length} variedades</Badge>
              </Button>
              
              {expandedCategory === category && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {varieties.map((variety) => {
                    const selectedQty = getSelectedQuantity(variety.id);
                    const totalStock = getTotalStock(variety.id);
                    const stockInfo = getStockForVariety(variety.id);
                    
                    return (
                      <Card key={variety.id} className="relative">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <h4 className="font-medium">{variety.name}</h4>
                              {variety.description && (
                                <p className="text-sm text-muted-foreground">{variety.description}</p>
                              )}
                              {variety.origin && (
                                <p className="text-xs text-muted-foreground">Origen: {variety.origin}</p>
                              )}
                            </div>
                            {variety.price_per_kg && (
                              <Badge variant="outline">${variety.price_per_kg}/kg</Badge>
                            )}
                          </div>

                          {/* Stock Info */}
                          {stockInfo.length > 0 && (
                            <div className="mb-3">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center space-x-1 text-xs text-muted-foreground cursor-help">
                                      <Info className="h-3 w-3" />
                                      <span>Stock actual: {totalStock} kg</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      {stockInfo.map((stock, idx) => (
                                        <div key={idx}>
                                          Tolva {stock.hopper_number}: {stock.current_kg} kg
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          )}

                          {/* Quantity Controls */}
                          {selectedQty > 0 ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateQuantity(variety.id, selectedQty - 1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={selectedQty}
                                  onChange={(e) => updateQuantity(variety.id, parseFloat(e.target.value) || 0)}
                                  className="w-20 text-center"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateQuantity(variety.id, selectedQty + 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <Label className="text-sm">kg</Label>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addItem(variety)}
                              className="w-full"
                            >
                              <Plus className="mr-2 h-3 w-3" />
                              Agregar
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
              <Separator className="my-4" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Selected Items Summary */}
      {selectedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen del Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selectedItems.map((item) => (
                <div key={item.coffee_variety_id} className="flex justify-between items-center p-3 border rounded">
                  <div>
                    <div className="font-medium">{item.variety_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.quantity_kg} kg
                      {item.price_per_kg && ` × $${item.price_per_kg} = $${(item.quantity_kg * item.price_per_kg).toFixed(2)}`}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeItem(item.coffee_variety_id)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              
              {calculateTotal() > 0 && (
                <div className="pt-3 border-t">
                  <div className="flex justify-between items-center font-medium">
                    <span>Total estimado:</span>
                    <span>${calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}