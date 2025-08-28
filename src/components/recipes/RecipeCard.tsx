import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, FileText, Eye, Edit, Copy, Share, Archive } from "lucide-react";
import { RecipeStatusBadge, type RecipeStatus, type RecipeType } from "./RecipeStatusBadge";
import { RecipeKPIGrid } from "./RecipeKPIGrid";
import { Badge } from "@/components/ui/badge";

export interface Recipe {
  id: string;
  name: string;
  method: string;
  status: RecipeStatus;
  type: RecipeType;
  ratio: string;
  coffee: string;
  time: string;
  temperature: string;
  grind?: string;
  description?: string;
  isActive?: boolean;
}

interface RecipeCardProps {
  recipe: Recipe;
  onEdit?: (recipe: Recipe) => void;
  onDuplicate?: (recipe: Recipe) => void;
  onShare?: (recipe: Recipe) => void;
  onArchive?: (recipe: Recipe) => void;
  onToggleActive?: (recipe: Recipe, isActive: boolean) => void;
  onViewPDF?: (recipe: Recipe) => void;
  onView?: (recipe: Recipe) => void;
}

export function RecipeCard({ 
  recipe, 
  onEdit, 
  onDuplicate, 
  onShare, 
  onArchive, 
  onToggleActive,
  onViewPDF,
  onView 
}: RecipeCardProps) {
  const isInteractive = recipe.status !== "archived";

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground line-clamp-1">{recipe.name}</h3>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge variant="outline" className="text-xs">
                {recipe.method}
              </Badge>
              <RecipeStatusBadge status={recipe.status} type={recipe.type} />
              {recipe.type === "personal" && (
                <Badge variant="secondary" className="text-xs">Mi Receta</Badge>
              )}
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {isInteractive && (
                <>
                  <DropdownMenuItem onClick={() => onEdit?.(recipe)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicate?.(recipe)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onShare?.(recipe)}>
                    <Share className="h-4 w-4 mr-2" />
                    Compartir
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={() => onArchive?.(recipe)}>
                <Archive className="h-4 w-4 mr-2" />
                {recipe.status === "archived" ? "Desarchivar" : "Archivar"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <RecipeKPIGrid
          ratio={recipe.ratio}
          coffee={recipe.coffee}
          time={recipe.time}
          temperature={recipe.temperature}
          grind={recipe.grind}
        />

        {recipe.description && (
          <div className="pt-2 border-t border-border/50">
            <p className="text-sm text-muted-foreground line-clamp-2">
              {recipe.description}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            {isInteractive && onToggleActive && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50">
                <Switch
                  checked={recipe.isActive}
                  onCheckedChange={(checked) => onToggleActive(recipe, checked)}
                />
                <span className="text-sm font-medium">
                  {recipe.isActive ? "Activa" : "Activar"}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => onViewPDF?.(recipe)}
            >
              <FileText className="h-4 w-4" />
            </Button>
            {onView && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => onView(recipe)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}