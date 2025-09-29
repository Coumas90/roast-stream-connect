import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Coffee, Plus, Minus, Eye, ShoppingCart } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SimplifiedCoffeeCardProps {
  coffee: {
    id: string;
    name: string;
    category: string;
    price_per_kg?: number;
    image_url?: string;
    description?: string;
    specifications?: any;
  };
  selectedQuantity: number;
  stockLevel?: number;
  stockStatus?: "low" | "medium" | "good";
  onQuickAdd: () => void;
  onUpdateQuantity: (quantity: number) => void;
  onViewDetails: () => void;
  unitLabel?: string;
}

export function SimplifiedCoffeeCard({
  coffee,
  selectedQuantity,
  stockLevel,
  stockStatus = "good",
  onQuickAdd,
  onUpdateQuantity,
  onViewDetails,
  unitLabel = "kg"
}: SimplifiedCoffeeCardProps) {
  const getStockColor = () => {
    switch (stockStatus) {
      case "low": return "bg-destructive";
      case "medium": return "bg-warning";
      default: return "bg-success";
    }
  };

  const getCategoryBadge = () => {
    if (coffee.category === "tupa") return { variant: "default" as const, label: "TUPÁ" };
    return { variant: "secondary" as const, label: "Otros" };
  };

  const categoryInfo = getCategoryBadge();

  return (
    <Card className="group hover:shadow-lg hover:border-primary/50 transition-all duration-300 border-2">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          {/* Coffee Image */}
          <div className="flex-shrink-0 relative">
            {coffee.image_url ? (
              <div className="relative">
                <img
                  src={coffee.image_url}
                  alt={coffee.name}
                  className="w-16 h-16 rounded-lg object-cover border shadow-sm group-hover:shadow-md transition-shadow"
                />
                {coffee.specifications?.overall && (
                  <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {coffee.specifications.overall}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center border-2 border-dashed">
                <Coffee className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            
            {/* Stock indicator */}
            {stockLevel !== undefined && (
              <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full ${getStockColor()} border-2 border-background`} />
            )}
          </div>

          {/* Coffee Info */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-1">
                  {coffee.name}
                </h4>
                <div className="flex items-center space-x-1 mt-1">
                  <Badge variant={categoryInfo.variant} className="text-xs">
                    {categoryInfo.label}
                  </Badge>
                  {coffee.price_per_kg && (
                    <Badge variant="outline" className="text-xs text-primary">
                      ${coffee.price_per_kg}/{unitLabel}
                    </Badge>
                  )}
                </div>
              </div>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onViewDetails}
                      className="h-8 w-8 p-0 opacity-60 hover:opacity-100"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ver detalles</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Stock info */}
            {stockLevel !== undefined && (
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${getStockColor()}`} />
                <span>Stock: {stockLevel} {unitLabel}</span>
              </div>
            )}

            {/* Description preview */}
            {coffee.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {coffee.description}
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-3 pt-3 border-t">
          {selectedQuantity > 0 ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUpdateQuantity(selectedQuantity - 1)}
                  className="h-8 w-8 p-0"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  type="number"
                  min="0"
                  value={selectedQuantity}
                  onChange={(e) => onUpdateQuantity(parseInt(e.target.value) || 0)}
                  className="w-16 h-8 text-center text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUpdateQuantity(selectedQuantity + 1)}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">{unitLabel}</span>
            </div>
          ) : (
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onQuickAdd}
                className="flex-1 h-8 text-xs"
              >
                <Plus className="mr-1 h-3 w-3" />
                Agregar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => onUpdateQuantity(5)}
                className="h-8 text-xs px-2"
              >
                +5
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}