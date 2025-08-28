import { Timer, Coffee, Thermometer, Scale } from "lucide-react";

interface RecipeKPIGridProps {
  ratio: string;
  coffee: string;
  time: string;
  temperature: string;
  grind?: string;
}

export function RecipeKPIGrid({ ratio, coffee, time, temperature, grind }: RecipeKPIGridProps) {
  const kpis = [
    { icon: Scale, label: "Ratio", value: ratio },
    { icon: Coffee, label: "Café", value: coffee },
    { icon: Timer, label: "Tiempo", value: time },
    { icon: Thermometer, label: "Temperatura", value: temperature },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {kpis.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-sm font-medium text-foreground">{value}</span>
          </div>
        </div>
      ))}
      {grind && (
        <div className="col-span-2 flex items-center gap-2 p-2 rounded-md bg-muted/50">
          <div className="h-4 w-4 rounded-full bg-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Molienda</span>
            <span className="text-sm font-medium text-foreground">{grind}</span>
          </div>
        </div>
      )}
    </div>
  );
}