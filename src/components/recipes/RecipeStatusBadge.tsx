import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type RecipeStatus = "draft" | "published" | "review" | "archived";
export type RecipeType = "personal" | "team" | "official" | "template";

interface RecipeStatusBadgeProps {
  status: RecipeStatus;
  type?: RecipeType;
  className?: string;
}

export function RecipeStatusBadge({ status, type, className }: RecipeStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "draft":
        return { variant: "secondary" as const, text: "Draft" };
      case "review":
        return { variant: "warning" as const, text: "Under Review" };
      case "published":
        return { variant: "success" as const, text: "Published" };
      case "archived":
        return { variant: "outline" as const, text: "Archived" };
      default:
        return { variant: "secondary" as const, text: "Draft" };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge variant={config.variant} className={cn("text-xs", className)}>
      {config.text}
    </Badge>
  );
}