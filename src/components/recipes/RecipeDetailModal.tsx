import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Clock, 
  Coffee, 
  Thermometer, 
  Scale, 
  Edit, 
  Copy, 
  Share, 
  FileText,
  ChefHat,
  Timer
} from "lucide-react";
import { Recipe } from "./RecipeCard";
import { RecipeStatusBadge } from "./RecipeStatusBadge";

interface RecipeDetailModalProps {
  recipe: Recipe | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (recipe: Recipe) => void;
  onDuplicate?: (recipe: Recipe) => void;
  onShare?: (recipe: Recipe) => void;
  onViewPDF?: (recipe: Recipe) => void;
}

export function RecipeDetailModal({
  recipe,
  open,
  onClose,
  onEdit,
  onDuplicate,
  onShare,
  onViewPDF
}: RecipeDetailModalProps) {
  if (!recipe) return null;

  const isActive = recipe.isActive ?? recipe.is_active ?? false;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-2xl font-bold mb-2">
                {recipe.name}
              </DialogTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-primary/40 text-primary">
                  {recipe.method}
                </Badge>
                <RecipeStatusBadge status={recipe.status} type={recipe.type} />
                {isActive && (
                  <Badge className="bg-success text-success-foreground animate-pulse">
                    Activa
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {onEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(recipe)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
              {onDuplicate && (
                <Button variant="outline" size="sm" onClick={() => onDuplicate(recipe)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicar
                </Button>
              )}
              {onShare && (
                <Button variant="outline" size="sm" onClick={() => onShare(recipe)}>
                  <Share className="h-4 w-4 mr-2" />
                  Compartir
                </Button>
              )}
              {onViewPDF && (
                <Button variant="default" size="sm" onClick={() => onViewPDF(recipe)}>
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Description */}
          {recipe.description && (
            <div>
              <h3 className="font-semibold mb-2">Descripción</h3>
              <p className="text-muted-foreground">{recipe.description}</p>
            </div>
          )}

          {/* Key Parameters Grid */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <ChefHat className="h-5 w-5 mr-2" />
              Parámetros de Preparación
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recipe.ratio && (
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Scale className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Ratio</p>
                      <p className="font-semibold">{recipe.ratio}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {recipe.coffee && (
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Coffee className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Café</p>
                      <p className="font-semibold">{recipe.coffee}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {recipe.time && (
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Tiempo</p>
                      <p className="font-semibold">{recipe.time}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {recipe.temperature && (
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Thermometer className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Temperatura</p>
                      <p className="font-semibold">{recipe.temperature}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {recipe.grind && (
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Coffee className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Molienda</p>
                      <p className="font-semibold capitalize">{recipe.grind}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Steps */}
          {recipe.steps && recipe.steps.length > 0 && (
            <div>
              <h3 className="font-semibold mb-4 flex items-center">
                <Timer className="h-5 w-5 mr-2" />
                Pasos de Preparación
              </h3>
              <div className="space-y-4">
                {recipe.steps.map((step, index) => (
                  <Card key={step.id || index} className="border-l-4 border-l-primary">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold flex-shrink-0">
                          {step.order || index + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold mb-2">{step.title}</h4>
                          <p className="text-muted-foreground mb-2">{step.description}</p>
                          {(step.time || step.water) && (
                            <div className="flex gap-4 text-sm">
                              {step.time && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {step.time} min
                                </div>
                              )}
                              {step.water && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Coffee className="h-3 w-3" />
                                  {step.water} ml
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {recipe.notes && (
            <div>
              <h3 className="font-semibold mb-2">Notas</h3>
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-muted-foreground">{recipe.notes}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-muted-foreground border-t pt-4">
            <div className="flex justify-between">
              <span>Creada: {new Date(recipe.created_at || '').toLocaleDateString()}</span>
              <span>Actualizada: {new Date(recipe.updated_at || '').toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}