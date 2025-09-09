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
  method?: string;
  status: RecipeStatus;
  type: RecipeType;
  ratio?: string;
  coffee: string;
  time?: string;
  temperature?: string;
  grind?: string;
  description?: string;
  isActive?: boolean;
  // For backwards compatibility with the database
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
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
  const isActive = recipe.isActive ?? recipe.is_active ?? false;

  return (
    <Card className="group hover:shadow-lg hover:border-primary/20 transition-all duration-300 animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-2">
              <h3 className="font-semibold text-foreground line-clamp-1 flex-1">{recipe.name}</h3>
              {isActive && (
                <div className="h-2 w-2 rounded-full bg-success animate-pulse flex-shrink-0 mt-2" />
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                {recipe.method}
              </Badge>
              <RecipeStatusBadge status={recipe.status} type={recipe.type} />
              {recipe.type === "personal" && (
                <Badge variant="secondary" className="text-xs">Mi Receta</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Por Juan Pérez</span>
              <span>•</span>
              <span>Hace 2 días</span>
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

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2">
            {isInteractive && onToggleActive && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
                <Switch
                  checked={isActive}
                  onCheckedChange={(checked) => onToggleActive(recipe, checked)}
                />
                <span className="text-sm font-medium text-primary">
                  {isActive ? "Activa" : "Activar"}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={() => onViewPDF?.(recipe)}
            >
              <FileText className="h-4 w-4" />
            </Button>
            {onView && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 hover:bg-primary/10 hover:text-primary transition-colors"
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