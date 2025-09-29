import React, { useState } from "react";
import { Coffee, Package2, Search, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CoffeeDetailModal } from "@/components/coffee/CoffeeDetailModal";
import { SimplifiedCoffeeCard } from "./SimplifiedCoffeeCard";

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
  const [selectedCoffeeForDetail, setSelectedCoffeeForDetail] = useState<any>(null);
  const [showCoffeeDetail, setShowCoffeeDetail] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Fetch coffee varieties for ground coffee (tolvas) - only bulk available
  const { data: coffeeVarieties, isLoading: loadingVarieties } = useQuery({
    queryKey: ["coffee-varieties-bulk"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coffee_varieties")
        .select("*")
        .eq("active", true)
        .eq("available_bulk", true)
        .order("category")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch coffee varieties available as packaged products (cuartitos)  
  const { data: coffeeProducts, isLoading: loadingProducts } = useQuery({
    queryKey: ["coffee-varieties-packaged"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coffee_varieties")
        .select("*")
        .eq("active", true)
        .eq("available_packaged", true)
        .order("category")
        .order("name");
      if (error) throw error;
      return data || [];
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
    
    const existingItem = selectedGroundItems.find(item => item.coffee_variety_id === varietyId);
    
    if (existingItem) {
      // Update existing item
      const updatedItems = selectedGroundItems.map(item =>
        item.coffee_variety_id === varietyId
          ? { ...item, quantity_kg: newQuantity }
          : item
      );
      onGroundItemsChange(updatedItems);
    } else {
      // Create new item if it doesn't exist
      const variety = coffeeVarieties?.find(v => v.id === varietyId);
      if (variety) {
        const newItem: GroundCoffeeOrderItem = {
          coffee_variety_id: varietyId,
          quantity_kg: newQuantity,
          variety_name: variety.name,
          category: variety.category,
          price_per_kg: variety.price_per_kg,
        };
        onGroundItemsChange([...selectedGroundItems, newItem]);
      }
    }
  };

  const removeGroundItem = (varietyId: string) => {
    const updatedItems = selectedGroundItems.filter(item => item.coffee_variety_id !== varietyId);
    onGroundItemsChange(updatedItems);
  };

  const getSelectedGroundQuantity = (varietyId: string) => {
    const item = selectedGroundItems.find(item => item.coffee_variety_id === varietyId);
    return item?.quantity_kg || 0;
  };

  // Helper functions for coffee varieties available as products
  const addProductItem = (variety: any) => {
    const existingItem = selectedProductItems.find(item => item.coffee_product_id === variety.id);
    if (existingItem) {
      updateProductQuantity(variety.id, existingItem.quantity_units + 1);
    } else {
      const newItem: ProductOrderItem = {
        coffee_product_id: variety.id,
        quantity_units: 1,
        product_name: variety.name,
        weight_grams: 250, // Default cuartito weight
        product_type: variety.category === 'tupa' ? 'cuartito' : 'other',
        price_per_unit: variety.price_per_kg ? variety.price_per_kg * 0.25 : undefined, // Estimate price for 250g
        sku: variety.name.toLowerCase().replace(/\s+/g, '-'),
      };
      onProductItemsChange([...selectedProductItems, newItem]);
    }
  };

  const updateProductQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeProductItem(productId);
      return;
    }
    
    const existingItem = selectedProductItems.find(item => item.coffee_product_id === productId);
    
    if (existingItem) {
      // Update existing item
      const updatedItems = selectedProductItems.map(item =>
        item.coffee_product_id === productId
          ? { ...item, quantity_units: newQuantity }
          : item
      );
      onProductItemsChange(updatedItems);
    } else {
      // Create new item if it doesn't exist
      const variety = coffeeProducts?.find(v => v.id === productId);
      if (variety) {
        const newItem: ProductOrderItem = {
          coffee_product_id: productId,
          quantity_units: newQuantity,
          product_name: variety.name,
          weight_grams: 250, // Default cuartito weight
          product_type: variety.category === 'tupa' ? 'cuartito' : 'other',
          price_per_unit: variety.price_per_kg ? variety.price_per_kg * 0.25 : undefined, // Estimate price for 250g
          sku: variety.name.toLowerCase().replace(/\s+/g, '-'),
        };
        onProductItemsChange([...selectedProductItems, newItem]);
      }
    }
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

  // Filter coffee varieties based on search and category
  const filteredGroundCoffees = coffeeVarieties?.filter(variety => {
    const matchesSearch = !searchTerm || 
      variety.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (variety.description && variety.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = categoryFilter === "all" || variety.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  }) || [];

  const filteredProducts = coffeeProducts?.filter(variety => {
    const matchesSearch = !searchTerm || 
      variety.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (variety.description && variety.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = categoryFilter === "all" || variety.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  }) || [];

  if (loadingVarieties || loadingProducts) {
    return <div className="text-center py-8">Cargando variedades de café...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar café por nombre o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filtrar por categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            <SelectItem value="tupa">Café TUPÁ</SelectItem>
            <SelectItem value="other">Otros Proveedores</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Current Stock Display - Compact */}
      {currentStock && currentStock.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <Coffee className="mr-2 h-4 w-4" />
              Stock Actual en Tolvas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {currentStock.map((stock) => (
                <div key={stock.id} className="p-2 border rounded text-center">
                  <div className="text-xs font-medium">T{stock.hopper_number}</div>
                  <div className="text-xs text-muted-foreground truncate">{stock.coffee_varieties?.name}</div>
                  <Badge 
                    variant={stock.current_kg > 5 ? "default" : stock.current_kg > 2 ? "secondary" : "destructive"}
                    className="text-xs mt-1"
                  >
                    {stock.current_kg}kg
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
            Café en Grano ({filteredGroundCoffees.length})
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center">
            <Package2 className="mr-2 h-4 w-4" />
            Productos Terminados ({filteredProducts.length})
          </TabsTrigger>
        </TabsList>

        {/* Ground Coffee Tab */}
        <TabsContent value="ground">
          <div className="space-y-4">
            {filteredGroundCoffees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Coffee className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No se encontraron cafés en grano con los filtros aplicados</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGroundCoffees.map((variety) => {
                  const selectedQty = getSelectedGroundQuantity(variety.id);
                  const totalStock = getTotalStock(variety.id);
                  const stockStatus = totalStock <= 2 ? "low" : totalStock <= 5 ? "medium" : "good";
                  
                  return (
                    <SimplifiedCoffeeCard
                      key={variety.id}
                      coffee={variety}
                      selectedQuantity={selectedQty}
                      stockLevel={totalStock}
                      stockStatus={stockStatus}
                      onQuickAdd={() => addGroundItem(variety)}
                      onUpdateQuantity={(qty) => updateGroundQuantity(variety.id, qty)}
                      onViewDetails={() => {
                        setSelectedCoffeeForDetail(variety);
                        setShowCoffeeDetail(true);
                      }}
                      unitLabel="kg"
                    />
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products">
          <div className="space-y-4">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No se encontraron productos terminados con los filtros aplicados</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((variety) => {
                  const selectedQty = getSelectedProductQuantity(variety.id);
                  
                  return (
                    <SimplifiedCoffeeCard
                      key={variety.id}
                      coffee={variety}
                      selectedQuantity={selectedQty}
                      onQuickAdd={() => addProductItem(variety)}
                      onUpdateQuantity={(qty) => updateProductQuantity(variety.id, qty)}
                      onViewDetails={() => {
                        setSelectedCoffeeForDetail(variety);
                        setShowCoffeeDetail(true);
                      }}
                      unitLabel="unidades"
                    />
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Coffee Detail Modal */}
      <CoffeeDetailModal
        variety={selectedCoffeeForDetail}
        open={showCoffeeDetail}
        onOpenChange={(open) => {
          setShowCoffeeDetail(open);
          if (!open) {
            setSelectedCoffeeForDetail(null);
          }
        }}
      />
    </div>
  );
}