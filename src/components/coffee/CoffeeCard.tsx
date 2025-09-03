import React from "react";
import { Edit, Eye, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface CoffeeCardProps {
  variety: any;
  onEdit: (variety: any) => void;
  onView: (variety: any) => void;
  onDelete: (id: string) => void;
}

export function CoffeeCard({ variety, onEdit, onView, onDelete }: CoffeeCardProps) {
  const specs = variety.specifications ? (typeof variety.specifications === 'string' ? JSON.parse(variety.specifications) : variety.specifications) : {};
  const score = specs?.technical?.score;
  const tastingScore = specs?.tasting?.overall;
  
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-video relative">
        {variety.image_url ? (
          <img
            src={variety.image_url}
            alt={variety.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <span className="text-muted-foreground text-sm">Sin imagen</span>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <Badge variant={variety.category === "tupa" ? "default" : "secondary"}>
            {variety.category === "tupa" ? "TUPÁ" : "Otro"}
          </Badge>
        </div>
        <div className="absolute top-2 right-2">
          <Badge variant={variety.active ? "default" : "destructive"}>
            {variety.active ? "Activa" : "Inactiva"}
          </Badge>
        </div>
        {score && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded-md text-sm flex items-center">
            <Star className="h-3 w-3 mr-1 fill-current" />
            {score}/100
          </div>
        )}
      </div>
      
      <CardContent className="p-4">
        <div className="space-y-2">
          <h3 className="font-semibold text-lg truncate">{variety.name}</h3>
          {variety.origin && (
            <p className="text-sm text-muted-foreground">{variety.origin}</p>
          )}
          
          {variety.price_per_kg && (
            <p className="text-sm font-medium">${variety.price_per_kg}/kg</p>
          )}
          
          {(tastingScore || 0) > 0 && (
            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              <span>Aroma: {specs?.tasting?.aroma || 0}/10</span>
              <span>Sabor: {specs?.tasting?.flavor || 0}/10</span>
              <span>General: {tastingScore}/10</span>
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center mt-4">
          <div className="flex space-x-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(variety)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(variety)}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(variety.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}