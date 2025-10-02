import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Coffee } from "lucide-react";
import { useActiveRecipes } from "@/hooks/useActiveRecipes";
import { useTenant } from "@/lib/tenant";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

export function ActiveRecipesWidget() {
  const { locationId } = useTenant();
  const { data: recipes, isLoading } = useActiveRecipes(locationId);
  const navigate = useNavigate();

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <Card className="shadow-elegant border-0 bg-gradient-card h-full">
      <CardHeader className="border-b border-border/50">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          Recetas Activas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {recipes && recipes.length > 0 ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  onClick={() => navigate('/app/recipes')}
                  className="p-4 rounded-lg bg-muted/50 hover:bg-muted/70 cursor-pointer transition-colors border border-transparent hover:border-primary/20"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-sm">{recipe.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      {recipe.method}
                    </Badge>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mb-3">
                    {recipe.coffee_name || 'Sin café asignado'}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <Coffee className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Dosis:</span>
                      <span className="font-medium">{recipe.target_dose_g}g</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Ratio:</span>
                      <span className="font-medium">
                        {recipe.target_ratio_min}-{recipe.target_ratio_max}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-12">
            <Coffee className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No hay recetas activas
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
