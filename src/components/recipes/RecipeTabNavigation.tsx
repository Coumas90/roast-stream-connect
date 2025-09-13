import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type RecipeTab = "all" | "active" | "personal" | "team" | "official" | "templates";

interface RecipeTabNavigationProps {
  activeTab: RecipeTab;
  onTabChange: (tab: RecipeTab) => void;
  isAdmin?: boolean;
  counts?: Partial<Record<RecipeTab, number>>;
}

export function RecipeTabNavigation({ 
  activeTab, 
  onTabChange, 
  isAdmin = false,
  counts = {} 
}: RecipeTabNavigationProps) {
  const tabs = [
    { id: "all" as const, label: "Todas", adminOnly: false },
    { id: "active" as const, label: "Activa", adminOnly: false },
    { id: "personal" as const, label: "Mi Receta", adminOnly: false },
    { id: "team" as const, label: "Equipo", adminOnly: false },
    { id: "official" as const, label: "Oficial TUPÁ", adminOnly: false },
    { id: "templates" as const, label: "Plantillas", adminOnly: true },
  ];

  const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdmin);

  return (
    <div className="border-b border-border bg-background">
      <div className="flex gap-1 px-6 pt-4">
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = counts[tab.id];
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors relative",
                "border-b-2 border-transparent -mb-px",
                isActive
                  ? "text-primary border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {tab.label}
              {count !== undefined && count > 0 && (
                <Badge variant="secondary" className="h-5 text-xs px-1.5">
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}