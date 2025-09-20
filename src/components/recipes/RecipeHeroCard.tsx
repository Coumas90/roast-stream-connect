import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  FileText, 
  Edit, 
  Copy, 
  Share, 
  Clock,
  User,
  Calendar
} from "lucide-react";
import { RecipeStatusBadge, type RecipeStatus, type RecipeType } from "./RecipeStatusBadge";
import { RecipeKPIGrid } from "./RecipeKPIGrid";
import { type Recipe } from "./RecipeCard";
import { getInitials, formatTimeAgo } from "@/lib/utils";

interface RecipeHeroCardProps {
  recipe: Recipe;
  onEdit?: (recipe: Recipe) => void;
  onDuplicate?: (recipe: Recipe) => void;
  onShare?: (recipe: Recipe) => void;
  onViewPDF?: (recipe: Recipe) => void;
  className?: string;
}

export function RecipeHeroCard({ 
  recipe, 
  onEdit, 
  onDuplicate, 
  onShare, 
  onViewPDF,
  className 
}: RecipeHeroCardProps) {
  return (
    <Card className={`border-primary/20 bg-gradient-to-br from-card to-primary/5 shadow-elegant ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-primary border-primary/40 bg-primary/10">
                Receta Activa
              </Badge>
              <RecipeStatusBadge status={recipe.status} type={recipe.type} />
            </div>
            
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
                {recipe.name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  <span>Por {recipe.creator_name || 'Usuario Anónimo'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span>Creada {formatTimeAgo(recipe.created_at)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>Actualizada {formatTimeAgo(recipe.updated_at)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onViewPDF?.(recipe)}
              className="bg-background/80"
            >
              <FileText className="h-4 w-4 mr-2" />
              Ver PDF
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onEdit?.(recipe)}
              className="bg-background/80"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onDuplicate?.(recipe)}
              className="bg-background/80"
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicar
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onShare?.(recipe)}
              className="bg-background/80"
            >
              <Share className="h-4 w-4 mr-2" />
              Compartir
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Enhanced KPIs */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">Parámetros de Preparación</h3>
          <RecipeKPIGrid
            ratio={recipe.ratio}
            coffee={recipe.coffee}
            time={recipe.time}
            temperature={recipe.temperature}
            grind={recipe.grind}
            enhanced
          />
        </div>

        {/* Method Badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Método:</span>
          <Badge variant="secondary" className="text-sm">
            {recipe.method}
          </Badge>
        </div>

        {/* Description */}
        {recipe.description && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Descripción</h3>
            <p className="text-muted-foreground leading-relaxed">
              {recipe.description}
            </p>
          </div>
        )}

        {/* Preparation Notes */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">Notas de Preparación</h3>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Esta receta ha sido optimizada para obtener el mejor balance entre acidez y dulzura. 
              Asegúrate de precalentar bien el equipo y usar agua filtrada para mejores resultados.
            </p>
          </div>
        </div>

        {/* Creator Info */}
        <div className="flex items-center gap-3 pt-4 border-t border-border/50">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials(recipe.creator_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">
              {recipe.creator_name || 'Usuario Anónimo'}
            </p>
            <p className="text-xs text-muted-foreground">
              {recipe.creator_name ? 'Miembro del equipo' : 'Creador no disponible'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}