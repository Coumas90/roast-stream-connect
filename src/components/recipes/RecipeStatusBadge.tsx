import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type RecipeStatus = "draft" | "review" | "active" | "oficial" | "archived";
export type RecipeType = "personal" | "team" | "oficial" | "template";

interface RecipeStatusBadgeProps {
  status: RecipeStatus;
  type?: RecipeType;
  className?: string;
}

export function RecipeStatusBadge({ status, type, className }: RecipeStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "draft":
        return { variant: "secondary" as const, text: "Borrador" };
      case "review":
        return { variant: "warning" as const, text: "En revisión" };
      case "active":
        return { variant: "success" as const, text: "Activa" };
      case "oficial":
        return { variant: "default" as const, text: "Oficial TUPÁ" };
      case "archived":
        return { variant: "outline" as const, text: "Archivada" };
      default:
        return { variant: "secondary" as const, text: "Borrador" };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge variant={config.variant} className={cn("text-xs", className)}>
      {config.text}
    </Badge>
  );
}