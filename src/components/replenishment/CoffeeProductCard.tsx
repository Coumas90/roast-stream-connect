import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Minus, Package, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CoffeeProductCardProps {
  product: {
    id: string;
    name: string;
    weight_grams: number;
    price: number;
    sku: string;
    product_type: string;
    stock_quantity: number;
    min_stock_level: number;
    coffee_varieties?: {
      name: string;
      category: string;
      image_url?: string;
      specifications?: any;
    };
  };
  selectedQuantity: number;
  onAdd: () => void;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}

export function CoffeeProductCard({
  product,
  selectedQuantity,
  onAdd,
  onUpdateQuantity,
  onRemove
}: CoffeeProductCardProps) {
  const getStockBadgeVariant = () => {
    if (product.stock_quantity <= product.min_stock_level) return "destructive";
    if (product.stock_quantity <= product.min_stock_level * 2) return "secondary";
    return "default";
  };

  const getProductTypeLabel = () => {
    switch (product.product_type) {
      case "cuartito": return "Cuartito";
      case "package": return "Paquete";
      default: return "Producto";
    }
  };

  const formatWeight = () => {
    if (product.weight_grams >= 1000) {
      return `${product.weight_grams / 1000}kg`;
    }
    return `${product.weight_grams}g`;
  };

  return (
    <Card className="relative">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-medium">{product.coffee_varieties?.name || product.name}</h4>
            </div>
            <div className="flex items-center space-x-2 mb-2">
              <Badge variant="outline">{getProductTypeLabel()}</Badge>
              <Badge variant="secondary">{formatWeight()}</Badge>
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

        {/* Stock Info */}
        <div className="mb-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-1 text-xs text-muted-foreground cursor-help">
                  <Info className="h-3 w-3" />
                  <span>Stock disponible:</span>
                  <Badge 
                    variant={getStockBadgeVariant()}
                    className="text-xs"
                  >
                    {product.stock_quantity} unidades
                  </Badge>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div>Stock actual: {product.stock_quantity} unidades</div>
                  <div>Nivel mínimo: {product.min_stock_level} unidades</div>
                  {product.stock_quantity <= product.min_stock_level && (
                    <div className="text-red-500 font-medium">¡Stock bajo!</div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Quantity Controls */}
        {selectedQuantity > 0 ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onUpdateQuantity(selectedQuantity - 1)}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                min="0"
                value={selectedQuantity}
                onChange={(e) => onUpdateQuantity(parseInt(e.target.value) || 0)}
                className="w-20 text-center"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => onUpdateQuantity(selectedQuantity + 1)}
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
            onClick={onAdd}
            className="w-full"
          >
            <Plus className="mr-2 h-3 w-3" />
            Agregar al Pedido
          </Button>
        )}
      </CardContent>
    </Card>
  );
}