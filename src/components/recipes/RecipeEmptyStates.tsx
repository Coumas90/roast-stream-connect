import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Coffee, 
  Users, 
  Star, 
  Plus, 
  Wifi,
  AlertCircle
} from "lucide-react";
import { type RecipeTab } from "./RecipeTabNavigation";

interface RecipeEmptyStateProps {
  tab: RecipeTab;
  onCreateNew?: () => void;
  onViewOficial?: () => void;
  isAdmin?: boolean;
}

export function RecipeEmptyState({ 
  tab, 
  onCreateNew, 
  onViewOficial, 
  isAdmin = false 
}: RecipeEmptyStateProps) {
  const getEmptyStateConfig = () => {
    switch (tab) {
      case "active":
        return {
          icon: Coffee,
          title: "No hay receta activa",
          description: "Activa una receta personal o del equipo para comenzar a preparar café con parámetros consistentes",
          actions: [
            { label: "Ver Mi Receta", onClick: onViewOficial, variant: "outline" as const },
            { label: "Nueva Receta", onClick: onCreateNew, variant: "default" as const, icon: Plus },
          ]
        };
        
      case "personal":
        return {
          icon: Coffee,
          title: "Crea tu primera receta personal",
          description: "Personaliza tus parámetros de preparación o activa una receta oficial TUPÁ como base",
          actions: [
            { label: "Ver Oficiales TUPÁ", onClick: onViewOficial, variant: "outline" as const },
            { label: "+ Nueva receta", onClick: onCreateNew, variant: "default" as const, icon: Plus },
          ]
        };
        
      case "team":
        return {
          icon: Users,
          title: "Tu equipo aún no ha compartido recetas",
          description: "Las recetas compartidas por tu equipo aparecerán aquí una vez aprobadas",
          actions: [
            { label: "+ Nueva receta", onClick: onCreateNew, variant: "default" as const, icon: Plus },
          ]
        };
        
      case "oficial":
        return {
          icon: Wifi,
          title: "Aún no hay plantillas oficiales",
          description: "Consulta con tu administrador. Las recetas oficiales TUPÁ aparecerán aquí cuando estén disponibles",
          actions: []
        };
        
      case "templates":
        return {
          icon: Star,
          title: isAdmin ? "Crea plantillas oficiales" : "Sin acceso a plantillas",
          description: isAdmin 
            ? "Diseña recetas maestras que estarán disponibles para todas las ubicaciones"
            : "Solo los administradores pueden gestionar plantillas oficiales",
          actions: isAdmin ? [
            { label: "+ Nueva plantilla", onClick: onCreateNew, variant: "default" as const, icon: Plus },
          ] : []
        };
        
      default:
        return {
          icon: AlertCircle,
          title: "Estado no reconocido",
          description: "Ha ocurrido un error inesperado",
          actions: []
        };
    }
  };

  const config = getEmptyStateConfig();
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              {config.title}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {config.description}
            </p>
          </div>

          {config.actions.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {config.actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant}
                  onClick={action.onClick}
                  className="min-w-[140px]"
                >
                  {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}