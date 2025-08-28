import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Coffee, Droplets, CircleDot } from "lucide-react";

const METHODS = [
  { 
    id: "espresso", 
    label: "Espresso", 
    icon: Coffee, 
    description: "Café concentrado" 
  },
  { 
    id: "v60", 
    label: "V60", 
    icon: Droplets, 
    description: "Goteo manual" 
  },
  { 
    id: "chemex", 
    label: "Chemex", 
    icon: Droplets, 
    description: "Filtro grueso" 
  },
  { 
    id: "aeropress", 
    label: "Aeropress", 
    icon: CircleDot, 
    description: "Presión" 
  },
  { 
    id: "frenchpress", 
    label: "French Press", 
    icon: CircleDot, 
    description: "Inmersión" 
  },
  { 
    id: "coldbrew", 
    label: "Cold Brew", 
    icon: Droplets, 
    description: "Extracción fría" 
  },
];

interface MethodSelectorProps {
  value?: string;
  onChange: (method: string) => void;
  className?: string;
}

export function MethodSelector({ value, onChange, className }: MethodSelectorProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {METHODS.map((method) => {
          const isSelected = value === method.id;
          const Icon = method.icon;
          
          return (
            <button
              key={method.id}
              onClick={() => onChange(method.id)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                "hover:border-primary/50 hover:bg-primary/5",
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background"
              )}
            >
              <Icon className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium text-sm">{method.label}</div>
                <div className="text-xs text-muted-foreground">{method.description}</div>
              </div>
              {isSelected && (
                <Badge variant="default" className="text-xs mt-1">
                  Seleccionado
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}