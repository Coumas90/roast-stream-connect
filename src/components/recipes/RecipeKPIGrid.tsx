import { Timer, Coffee, Thermometer, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecipeKPIGridProps {
  ratio: string;
  coffee: string;
  time: string;
  temperature: string;
  grind?: string;
  enhanced?: boolean;
}

export function RecipeKPIGrid({ ratio, coffee, time, temperature, grind, enhanced = false }: RecipeKPIGridProps) {
  const kpis = [
    { icon: Scale, label: "Ratio", value: ratio, color: "text-primary" },
    { icon: Coffee, label: "Café", value: coffee, color: "text-amber-600" },
    { icon: Timer, label: "Tiempo", value: time, color: "text-blue-600" },
    { icon: Thermometer, label: "Temperatura", value: temperature, color: "text-red-500" },
  ];

  const iconSize = enhanced ? "h-6 w-6" : "h-4 w-4";
  const padding = enhanced ? "p-4" : "p-2";
  const gap = enhanced ? "gap-3" : "gap-2";

  return (
    <div className={cn("grid gap-3", enhanced ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-2")}>
      {kpis.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className={cn(
          "flex items-center rounded-lg bg-card border transition-all duration-200 hover:shadow-md",
          padding,
          gap,
          enhanced && "hover:border-primary/20"
        )}>
          <div className={cn(
            "flex-shrink-0 rounded-md p-2",
            enhanced ? "bg-primary/10" : "bg-muted/50"
          )}>
            <Icon className={cn(iconSize, enhanced ? color : "text-muted-foreground")} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className={cn("text-muted-foreground", enhanced ? "text-sm" : "text-xs")}>
              {label}
            </span>
            <span className={cn("font-medium text-foreground", enhanced ? "text-base" : "text-sm")}>
              {value}
            </span>
          </div>
        </div>
      ))}
      {grind && (
        <div className={cn(
          "flex items-center rounded-lg bg-card border transition-all duration-200 hover:shadow-md",
          padding,
          gap,
          enhanced ? "hover:border-primary/20 col-span-1 sm:col-span-2 lg:col-span-4" : "col-span-2"
        )}>
          <div className={cn(
            "flex-shrink-0 rounded-md p-2",
            enhanced ? "bg-primary/10" : "bg-muted/50"
          )}>
            <div className={cn(
              "rounded-full",
              enhanced ? "h-6 w-6 bg-orange-500" : "h-4 w-4 bg-muted-foreground"
            )} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className={cn("text-muted-foreground", enhanced ? "text-sm" : "text-xs")}>
              Molienda
            </span>
            <span className={cn("font-medium text-foreground", enhanced ? "text-base" : "text-sm")}>
              {grind}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}