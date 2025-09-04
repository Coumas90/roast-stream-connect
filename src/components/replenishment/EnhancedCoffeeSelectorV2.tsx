import React, { useState } from "react";
import { Coffee, Info, Package2, Plus, Minus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface GroundCoffeeOrderItem {
  coffee_variety_id: string;
  quantity_kg: number;
  variety_name: string;
  category: string;
  price_per_kg?: number;
  notes?: string;
}

export interface ProductOrderItem {
  coffee_product_id: string;
  quantity_units: number;
  product_name: string;
  weight_grams: number;
  product_type: string;
  price_per_unit?: number;
  sku: string;
}

interface EnhancedCoffeeSelectorV2Props {
  locationId: string;
  selectedGroundItems: GroundCoffeeOrderItem[];
  selectedProductItems: ProductOrderItem[];
  onGroundItemsChange: (items: GroundCoffeeOrderItem[]) => void;
  onProductItemsChange: (items: ProductOrderItem[]) => void;
}

export function EnhancedCoffeeSelectorV2({ 
  locationId, 
  selectedGroundItems,
  selectedProductItems,
  onGroundItemsChange,
  onProductItemsChange 
}: EnhancedCoffeeSelectorV2Props) {
  // Fetch coffee varieties for ground coffee (tolvas)
  const { data: coffeeVarieties, isLoading: loadingVarieties } = useQuery({
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

  // Fetch coffee products for cuartitos and packages  
  const { data: coffeeProducts, isLoading: loadingProducts } = useQuery({
    queryKey: ["coffee-products-active"],
    queryFn: async () => {
      // For now, return empty array since coffee_products table might not exist yet
      return [];
    },
  });

  // Fetch current stock for location
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

  // Helper functions for ground coffee
  const groupedVarieties = coffeeVarieties?.reduce((acc, variety) => {
    if (!acc[variety.category]) {
      acc[variety.category] = [];
    }
    acc[variety.category].push(variety);
    return acc;
  }, {} as Record<string, any[]>);

  const addGroundItem = (variety: any) => {
    const existingItem = selectedGroundItems.find(item => item.coffee_variety_id === variety.id);
    if (existingItem) {
      updateGroundQuantity(variety.id, existingItem.quantity_kg + 1);
    } else {
      const newItem: GroundCoffeeOrderItem = {
        coffee_variety_id: variety.id,
        quantity_kg: 1,
        variety_name: variety.name,
        category: variety.category,
        price_per_kg: variety.price_per_kg,
      };
      onGroundItemsChange([...selectedGroundItems, newItem]);
    }
  };

  const updateGroundQuantity = (varietyId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeGroundItem(varietyId);
      return;
    }
    
    const updatedItems = selectedGroundItems.map(item =>
      item.coffee_variety_id === varietyId
        ? { ...item, quantity_kg: newQuantity }
        : item
    );
    onGroundItemsChange(updatedItems);
  };

  const removeGroundItem = (varietyId: string) => {
    const updatedItems = selectedGroundItems.filter(item => item.coffee_variety_id !== varietyId);
    onGroundItemsChange(updatedItems);
  };

  const getSelectedGroundQuantity = (varietyId: string) => {
    const item = selectedGroundItems.find(item => item.coffee_variety_id === varietyId);
    return item?.quantity_kg || 0;
  };

  // Helper functions for coffee products
  const groupedProducts = coffeeProducts?.reduce((acc: any, product: any) => {
    const productType = product.product_type || 'other';
    if (!acc[productType]) {
      acc[productType] = [];
    }
    acc[productType].push(product);
    return acc;
  }, {} as Record<string, any[]>) || {};

  const addProductItem = (product: any) => {
    const existingItem = selectedProductItems.find(item => item.coffee_product_id === product.id);
    if (existingItem) {
      updateProductQuantity(product.id, existingItem.quantity_units + 1);
    } else {
      const newItem: ProductOrderItem = {
        coffee_product_id: product.id,
        quantity_units: 1,
        product_name: product.name,
        weight_grams: product.weight_grams,
        product_type: product.product_type,
        price_per_unit: product.price,
        sku: product.sku,
      };
      onProductItemsChange([...selectedProductItems, newItem]);
    }
  };

  const updateProductQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeProductItem(productId);
      return;
    }
    
    const updatedItems = selectedProductItems.map(item =>
      item.coffee_product_id === productId
        ? { ...item, quantity_units: newQuantity }
        : item
    );
    onProductItemsChange(updatedItems);
  };

  const removeProductItem = (productId: string) => {
    const updatedItems = selectedProductItems.filter(item => item.coffee_product_id !== productId);
    onProductItemsChange(updatedItems);
  };

  const getSelectedProductQuantity = (productId: string) => {
    const item = selectedProductItems.find(item => item.coffee_product_id === productId);
    return item?.quantity_units || 0;
  };

  // Stock helpers
  const getStockForVariety = (varietyId: string) => {
    return currentStock?.filter(stock => stock.coffee_variety_id === varietyId) || [];
  };

  const getTotalStock = (varietyId: string) => {
    const stocks = getStockForVariety(varietyId);
    return stocks.reduce((total, stock) => total + (stock.current_kg || 0), 0);
  };

  // Calculate totals
  const calculateGroundTotal = () => {
    return selectedGroundItems.reduce((total, item) => {
      if (item.price_per_kg) {
        return total + (item.quantity_kg * item.price_per_kg);
      }
      return total;
    }, 0);
  };

  const calculateProductTotal = () => {
    return selectedProductItems.reduce((total, item) => {
      if (item.price_per_unit) {
        return total + (item.quantity_units * item.price_per_unit);
      }
      return total;
    }, 0);
  };

  const formatWeight = (grams: number) => {
    if (grams >= 1000) {
      return `${grams / 1000}kg`;
    }
    return `${grams}g`;
  };

  if (loadingVarieties || loadingProducts) {
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

      {/* Main Selector Tabs */}
      <Tabs defaultValue="ground" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ground" className="flex items-center">
            <Coffee className="mr-2 h-4 w-4" />
            Café en Grano (Tolvas)
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center">
            <Package2 className="mr-2 h-4 w-4" />
            Productos Terminados (Cuartitos)
          </TabsTrigger>
        </TabsList>

        {/* Ground Coffee Tab */}
        <TabsContent value="ground">
          <Card>
            <CardHeader>
              <CardTitle>Seleccionar Café en Grano para Tolvas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(groupedVarieties || {}).map(([category, varieties]) => (
                <div key={category}>
                  <h3 className="text-lg font-semibold mb-4">
                    {category === "tupa" ? "Café TUPÁ" : "Otros Proveedores"}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {varieties.map((variety) => {
                      const selectedQty = getSelectedGroundQuantity(variety.id);
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
                                    onClick={() => updateGroundQuantity(variety.id, selectedQty - 1)}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={selectedQty}
                                    onChange={(e) => updateGroundQuantity(variety.id, parseFloat(e.target.value) || 0)}
                                    className="w-20 text-center"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateGroundQuantity(variety.id, selectedQty + 1)}
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
                                onClick={() => addGroundItem(variety)}
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
                  <Separator className="my-4" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coffee Products Tab */}
        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Seleccionar Productos Terminados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(groupedProducts).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay productos terminados disponibles.</p>
                  <p className="text-sm">Los cuartitos y otros productos aparecerán aquí cuando estén configurados.</p>
                </div>
              ) : (
                Object.entries(groupedProducts).map(([productType, products]) => (
                  <div key={productType}>
                    <h3 className="text-lg font-semibold mb-4">
                      {productType === "cuartito" ? "Cuartitos (250g)" : 
                       productType === "package" ? "Otros Paquetes" : "Productos"}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(products as any[]).map((product: any) => {
                        const selectedQty = getSelectedProductQuantity(product.id);
                        
                        return (
                          <Card key={product.id} className="relative">
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <Package2 className="h-4 w-4 text-muted-foreground" />
                                    <h4 className="font-medium">{product.name}</h4>
                                  </div>
                                  <div className="flex items-center space-x-2 mb-2">
                                    <Badge variant="outline">
                                      {productType === "cuartito" ? "Cuartito" : "Paquete"}
                                    </Badge>
                                    <Badge variant="secondary">{formatWeight(product.weight_grams)}</Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    SKU: {product.sku}
                                  </div>
                                  {product.price && (
                                    <div className="text-sm font-medium mt-1">
                                      ${product.price.toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Quantity Controls */}
                              {selectedQty > 0 ? (
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => updateProductQuantity(product.id, selectedQty - 1)}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={selectedQty}
                                      onChange={(e) => updateProductQuantity(product.id, parseInt(e.target.value) || 0)}
                                      className="w-20 text-center"
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => updateProductQuantity(product.id, selectedQty + 1)}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <Label className="text-sm">unidades</Label>
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addProductItem(product)}
                                  className="w-full"
                                >
                                  <Plus className="mr-2 h-3 w-3" />
                                  Agregar al Pedido
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                    <Separator className="my-4" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Order Summary */}
      {(selectedGroundItems.length > 0 || selectedProductItems.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen del Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Ground Coffee Items */}
              {selectedGroundItems.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Café en Grano (Tolvas)</h4>
                  <div className="space-y-2 mb-4">
                    {selectedGroundItems.map((item) => (
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
                          onClick={() => removeGroundItem(item.coffee_variety_id)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Product Items */}
              {selectedProductItems.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Productos Terminados</h4>
                  <div className="space-y-2 mb-4">
                    {selectedProductItems.map((item) => (
                      <div key={item.coffee_product_id} className="flex justify-between items-center p-3 border rounded">
                        <div>
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.quantity_units} unidades × {formatWeight(item.weight_grams)}
                            {item.price_per_unit && ` × $${item.price_per_unit} = $${(item.quantity_units * item.price_per_unit).toFixed(2)}`}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeProductItem(item.coffee_product_id)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Total */}
              {(calculateGroundTotal() > 0 || calculateProductTotal() > 0) && (
                <div className="pt-3 border-t">
                  <div className="space-y-1">
                    {calculateGroundTotal() > 0 && (
                      <div className="flex justify-between items-center">
                        <span>Café en grano:</span>
                        <span>${calculateGroundTotal().toFixed(2)}</span>
                      </div>
                    )}
                    {calculateProductTotal() > 0 && (
                      <div className="flex justify-between items-center">
                        <span>Productos terminados:</span>
                        <span>${calculateProductTotal().toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center font-medium text-lg border-t pt-2">
                      <span>Total estimado:</span>
                      <span>${(calculateGroundTotal() + calculateProductTotal()).toFixed(2)}</span>
                    </div>
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