import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coffee, Clock, Droplet, Thermometer } from "lucide-react";
import { useActiveRecipes } from "@/hooks/useActiveRecipes";
import { useTenant } from "@/lib/tenant";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

export function QuickCalibrationWidget() {
  const { locationId } = useTenant();
  const { data: recipes, isLoading } = useActiveRecipes(locationId);
  const navigate = useNavigate();

  const activeRecipe = recipes?.[0]; // Show first active recipe

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <Card className="shadow-elegant hover-lift border-0 bg-gradient-card">
      <CardHeader className="border-b border-border/50">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-gradient-brand">
            <Coffee className="h-6 w-6 text-white" />
          </div>
          Calibración Rápida
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {activeRecipe ? (
          <div className="space-y-6">
            {/* Active Coffee Info */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{activeRecipe.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {activeRecipe.coffee_name || 'Café activo'}
                </p>
              </div>
              <Badge variant="default" className="bg-gradient-brand">
                Activa
              </Badge>
            </div>

            {/* Target Parameters */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Coffee className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dosis</p>
                  <p className="font-semibold">{activeRecipe.target_dose_g}g</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Droplet className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Yield</p>
                  <p className="font-semibold">{activeRecipe.target_yield_value}g</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tiempo</p>
                  <p className="font-semibold">
                    {activeRecipe.target_time_min}-{activeRecipe.target_time_max}s
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Thermometer className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Temp</p>
                  <p className="font-semibold">{activeRecipe.target_temp_c}°C</p>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <Button 
              onClick={() => navigate('/app/recipes')}
              className="w-full bg-gradient-brand hover:shadow-glow transition-all duration-300"
              size="lg"
            >
              Abrir Panel de Calibración
            </Button>
          </div>
        ) : (
          <div className="text-center py-12">
            <Coffee className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              No hay recetas activas configuradas
            </p>
            <Button 
              onClick={() => navigate('/app/recipes')}
              variant="outline"
            >
              Ver Recetas
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
