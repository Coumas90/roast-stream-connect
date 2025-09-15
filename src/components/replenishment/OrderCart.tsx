import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { GroundCoffeeOrderItem, ProductOrderItem } from "./EnhancedCoffeeSelectorV2";
import { ShoppingCart, Minus, Plus, X, Package, Coffee } from "lucide-react";

interface OrderCartProps {
  selectedGroundItems: GroundCoffeeOrderItem[];
  selectedProductItems: ProductOrderItem[];
  formData: {
    delivery_type: string;
    notes: string;
  };
  loading: boolean;
  onGroundItemsChange: (items: GroundCoffeeOrderItem[]) => void;
  onProductItemsChange: (items: ProductOrderItem[]) => void;
  onFormDataChange: (data: { delivery_type: string; notes: string }) => void;
  onSubmitOrder: () => void;
}

export default function OrderCart({
  selectedGroundItems,
  selectedProductItems,
  formData,
  loading,
  onGroundItemsChange,
  onProductItemsChange,
  onFormDataChange,
  onSubmitOrder
}: OrderCartProps) {
  const totalItems = selectedGroundItems.length + selectedProductItems.length;
  const totalEstimatedPrice = [
    ...selectedGroundItems.map(item => (item.price_per_kg || 0) * item.quantity_kg),
    ...selectedProductItems.map(item => (item.price_per_unit || 0) * item.quantity_units)
  ].reduce((sum, price) => sum + price, 0);

  const updateGroundQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeGroundItem(index);
      return;
    }
    const updatedItems = [...selectedGroundItems];
    updatedItems[index].quantity_kg = newQuantity;
    onGroundItemsChange(updatedItems);
  };

  const updateProductQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeProductItem(index);
      return;
    }
    const updatedItems = [...selectedProductItems];
    updatedItems[index].quantity_units = newQuantity;
    onProductItemsChange(updatedItems);
  };

  const removeGroundItem = (index: number) => {
    const updatedItems = selectedGroundItems.filter((_, i) => i !== index);
    onGroundItemsChange(updatedItems);
  };

  const removeProductItem = (index: number) => {
    const updatedItems = selectedProductItems.filter((_, i) => i !== index);
    onProductItemsChange(updatedItems);
  };

  return (
    <div className="space-y-4">
      {/* Cart Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <ShoppingCart className="mr-2 h-5 w-5" />
              Carrito de Pedido
            </div>
            {totalItems > 0 && (
              <Badge variant="secondary">
                {totalItems} producto{totalItems !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {totalItems === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Tu carrito está vacío</p>
              <p className="text-xs">Selecciona productos para agregar al pedido</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Ground Coffee Items */}
              {selectedGroundItems.map((item, index) => (
                <div key={`ground-${index}`} className="p-3 border rounded-lg bg-background">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <Coffee className="h-4 w-4 mr-1 text-primary" />
                        <span className="font-medium text-sm">{item.variety_name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                      {item.price_per_kg && (
                        <p className="text-xs text-muted-foreground">
                          ${item.price_per_kg}/kg
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGroundItem(index)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateGroundQuantity(index, item.quantity_kg - 1)}
                        className="h-6 w-6 p-0"
                        disabled={item.quantity_kg <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="font-medium text-sm min-w-[40px] text-center">
                        {item.quantity_kg}kg
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateGroundQuantity(index, item.quantity_kg + 1)}
                        className="h-6 w-6 p-0"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {item.price_per_kg && (
                      <div className="text-sm font-medium">
                        ${(item.price_per_kg * item.quantity_kg).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Product Items */}
              {selectedProductItems.map((item, index) => (
                <div key={`product-${index}`} className="p-3 border rounded-lg bg-background">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <Package className="h-4 w-4 mr-1 text-primary" />
                        <span className="font-medium text-sm">{item.product_name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.weight_grams}g - {item.product_type}
                      </p>
                      {item.price_per_unit && (
                        <p className="text-xs text-muted-foreground">
                          ${item.price_per_unit}/unidad
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeProductItem(index)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateProductQuantity(index, item.quantity_units - 1)}
                        className="h-6 w-6 p-0"
                        disabled={item.quantity_units <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="font-medium text-sm min-w-[40px] text-center">
                        {item.quantity_units}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateProductQuantity(index, item.quantity_units + 1)}
                        className="h-6 w-6 p-0"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {item.price_per_unit && (
                      <div className="text-sm font-medium">
                        ${(item.price_per_unit * item.quantity_units).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Total */}
              {totalEstimatedPrice > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between items-center font-medium">
                    <span>Total estimado:</span>
                    <span className="text-primary">${totalEstimatedPrice.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Configuration */}
      {totalItems > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuración del Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delivery-type">Tipo de entrega</Label>
              <Select
                value={formData.delivery_type}
                onValueChange={(value) => 
                  onFormDataChange({ ...formData, delivery_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Estándar (5-7 días)</SelectItem>
                  <SelectItem value="urgent">Urgente (2-3 días)</SelectItem>
                  <SelectItem value="scheduled">Programada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas adicionales</Label>
              <Textarea
                id="notes"
                placeholder="Instrucciones especiales, horarios de entrega, etc."
                value={formData.notes}
                onChange={(e) => 
                  onFormDataChange({ ...formData, notes: e.target.value })
                }
                rows={3}
              />
            </div>

            <Button 
              onClick={onSubmitOrder}
              className="w-full"
              disabled={loading || totalItems === 0}
              size="lg"
            >
              {loading ? "Enviando..." : "Confirmar Pedido"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}