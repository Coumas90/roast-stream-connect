import { useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coffee, Loader2 } from "lucide-react";
import { useTupaCoffees } from "@/hooks/useCoffeeVarieties";

export interface CoffeeSelection {
  type: "tupa" | "other";
  tupaId?: string;
  customName?: string;
  origin?: string;
}

interface CoffeeSelectorProps {
  value: CoffeeSelection;
  onChange: (selection: CoffeeSelection) => void;
}

export function CoffeeSelector({ value, onChange }: CoffeeSelectorProps) {
  const { data: tupaCoffees, isLoading } = useTupaCoffees();
  
  const updateSelection = (updates: Partial<CoffeeSelection>) => {
    onChange({ ...value, ...updates });
  };

  return (
    <div className="space-y-4">
      <RadioGroup
        value={value.type}
        onValueChange={(type: "tupa" | "other") => updateSelection({ type })}
        className="space-y-4"
      >
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="tupa" id="tupa" />
            <Label htmlFor="tupa" className="text-sm font-medium">
              Café TUPÁ
            </Label>
          </div>
          
          {value.type === "tupa" && (
            <div className="ml-6 space-y-3">
              <Select 
                value={value.tupaId} 
                onValueChange={(tupaId) => updateSelection({ tupaId })}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoading ? "Cargando cafés..." : "Selecciona un café TUPÁ"} />
                </SelectTrigger>
                <SelectContent>
                  {isLoading ? (
                    <SelectItem value="loading" disabled>
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando cafés...
                      </div>
                    </SelectItem>
                  ) : tupaCoffees?.length ? (
                    tupaCoffees.map((coffee) => (
                      <SelectItem key={coffee.id} value={coffee.id}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                            <Coffee className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{coffee.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {coffee.description || coffee.origin}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="empty" disabled>
                      No hay cafés TUPÁ disponibles
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              {value.tupaId && tupaCoffees && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    {(() => {
                      const coffee = tupaCoffees.find(c => c.id === value.tupaId);
                      if (!coffee) return null;
                      
                      return (
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Coffee className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{coffee.name}</h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {coffee.description}
                            </p>
                            {coffee.origin && (
                              <p className="text-xs text-muted-foreground">
                                Origen: {coffee.origin}
                              </p>
                            )}
                            <div className="flex gap-1 mt-2">
                              <Badge variant="secondary" className="text-xs">
                                {coffee.category.toUpperCase()}
                              </Badge>
                              {coffee.available_bulk && (
                                <Badge variant="secondary" className="text-xs">
                                  Disponible a granel
                                </Badge>
                              )}
                              {coffee.price_per_kg && (
                                <Badge variant="secondary" className="text-xs">
                                  ${coffee.price_per_kg}/kg
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="other" id="other" />
            <Label htmlFor="other" className="text-sm font-medium">
              Otro café
            </Label>
          </div>
          
          {value.type === "other" && (
            <div className="ml-6 space-y-3">
              <div>
                <Label htmlFor="custom-name" className="text-xs text-muted-foreground">
                  Nombre del café *
                </Label>
                <Input
                  id="custom-name"
                  placeholder="Ej: Colombia Huila"
                  value={value.customName || ""}
                  onChange={(e) => updateSelection({ customName: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="origin" className="text-xs text-muted-foreground">
                  Origen (opcional)
                </Label>
                <Input
                  id="origin"
                  placeholder="Ej: Finca Los Andes, Colombia"
                  value={value.origin || ""}
                  onChange={(e) => updateSelection({ origin: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
      </RadioGroup>
    </div>
  );
}