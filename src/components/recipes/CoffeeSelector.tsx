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
import { Coffee } from "lucide-react";

const TUPA_COFFEES = [
  {
    id: "tupa-signature",
    name: "TUPÁ Signature",
    description: "Blend equilibrado, notas de chocolate y caramelo",
    image: "/api/placeholder/60/60",
  },
  {
    id: "tupa-finca-x",
    name: "TUPÁ Finca La Esperanza",
    description: "Single origin, notas florales y cítricas",
    image: "/api/placeholder/60/60",
  },
  {
    id: "tupa-especial",
    name: "TUPÁ Especial",
    description: "Tueste medio, notas de frutos secos",
    image: "/api/placeholder/60/60",
  },
];

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
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un café TUPÁ" />
                </SelectTrigger>
                <SelectContent>
                  {TUPA_COFFEES.map((coffee) => (
                    <SelectItem key={coffee.id} value={coffee.id}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                          <Coffee className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{coffee.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {coffee.description}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {value.tupaId && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    {(() => {
                      const coffee = TUPA_COFFEES.find(c => c.id === value.tupaId);
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
                            <div className="flex gap-1 mt-2">
                              <Badge variant="secondary" className="text-xs">
                                Ratio sugerido: 1:2
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                94°C
                              </Badge>
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