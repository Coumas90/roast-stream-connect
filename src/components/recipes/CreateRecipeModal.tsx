import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  Check,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MethodSelector } from "./MethodSelector";
import { CoffeeSelector, type CoffeeSelection } from "./CoffeeSelector";
import { StepsList, type RecipeStep } from "./StepsList";
import { useToast } from "@/hooks/use-toast";

interface RecipeFormData {
  name: string;
  method: string;
  coffee: CoffeeSelection;
  description: string;
  ratio: string;
  coffeeAmount: string;
  waterAmount: string;
  time: string;
  temperature: string;
  grind: string;
  steps: RecipeStep[];
  notes: string;
  sendForReview: boolean;
}

interface CreateRecipeModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: RecipeFormData, isDraft: boolean) => void;
  initialData?: Partial<RecipeFormData>;
  mode?: "create" | "edit";
}

const GRIND_OPTIONS = [
  { value: "fina", label: "Fina" },
  { value: "media-fina", label: "Media-fina" },
  { value: "media", label: "Media" },
  { value: "gruesa", label: "Gruesa" },
];

const STEP_TITLES = ["Básicos", "Parámetros", "Pasos & Notas"];

export function CreateRecipeModal({ 
  open, 
  onClose, 
  onSave, 
  initialData = {},
  mode = "create" 
}: CreateRecipeModalProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<RecipeFormData>({
    name: "",
    method: "",
    coffee: { type: "tupa" },
    description: "",
    ratio: "",
    coffeeAmount: "",
    waterAmount: "",
    time: "",
    temperature: "",
    grind: "",
    steps: [],
    notes: "",
    sendForReview: false,
    ...initialData,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setErrors({});
    }
  }, [open]);

  const updateFormData = (updates: Partial<RecipeFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    // Clear related errors
    Object.keys(updates).forEach(key => {
      if (errors[key]) {
        setErrors(prev => ({ ...prev, [key]: undefined }));
      }
    });
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.name.trim()) newErrors.name = "El nombre es obligatorio";
      if (!formData.method) newErrors.method = "Selecciona un método";
      if (formData.coffee.type === "tupa" && !formData.coffee.tupaId) {
        newErrors.coffee = "Selecciona un café TUPÁ";
      }
      if (formData.coffee.type === "other" && !formData.coffee.customName?.trim()) {
        newErrors.coffee = "Ingresa el nombre del café";
      }
    }

    if (step === 2) {
      if (!formData.ratio.trim()) newErrors.ratio = "El ratio es obligatorio";
      if (!formData.coffeeAmount.trim()) newErrors.coffeeAmount = "La cantidad de café es obligatoria";
      if (!formData.waterAmount.trim()) newErrors.waterAmount = "La cantidad de agua es obligatoria";
      if (!formData.time.trim()) newErrors.time = "El tiempo es obligatorio";
      if (!formData.temperature.trim()) newErrors.temperature = "La temperatura es obligatoria";
      if (!formData.grind) newErrors.grind = "Selecciona el tipo de molienda";
    }

    if (step === 3) {
      if (formData.steps.length === 0) {
        newErrors.steps = "Se requiere al menos un paso";
      } else {
        const hasEmptySteps = formData.steps.some(step => !step.title.trim() || !step.description.trim());
        if (hasEmptySteps) {
          newErrors.steps = "Todos los pasos deben tener título y descripción";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSave = (isDraft: boolean) => {
    if (!isDraft && !validateStep(3)) return;

    try {
      onSave(formData, isDraft);
      toast({
        title: isDraft ? "Borrador guardado" : mode === "edit" ? "Receta actualizada" : "Receta creada",
        description: isDraft ? "Tu receta se guardó como borrador" : "La receta está lista para usar",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "No pudimos guardar la receta. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const progress = (currentStep / 3) * 100;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4">
          <DialogTitle>
            {mode === "edit" ? "Editar receta" : "Crear nueva receta"}
          </DialogTitle>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Paso {currentStep} de 3: {STEP_TITLES[currentStep - 1]}
              </span>
              <span className="text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {currentStep === 1 && (
            <div className="space-y-6 p-1">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la receta *</Label>
                <Input
                  id="name"
                  placeholder="Ej: Espresso TUPÁ Personal"
                  value={formData.name}
                  onChange={(e) => updateFormData({ name: e.target.value })}
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Método *</Label>
                <MethodSelector
                  value={formData.method}
                  onChange={(method) => updateFormData({ method })}
                />
                {errors.method && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.method}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Selector de Café *</Label>
                <CoffeeSelector
                  value={formData.coffee}
                  onChange={(coffee) => updateFormData({ coffee })}
                />
                {errors.coffee && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.coffee}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción corta</Label>
                <Textarea
                  id="description"
                  placeholder="Describe brevemente tu receta (máx. 140 caracteres)"
                  value={formData.description}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                  maxLength={140}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.description.length}/140 caracteres
                </p>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6 p-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ratio">Ratio *</Label>
                  <Input
                    id="ratio"
                    placeholder="Ej: 1:2"
                    value={formData.ratio}
                    onChange={(e) => updateFormData({ ratio: e.target.value })}
                    className={errors.ratio ? "border-destructive" : ""}
                  />
                  {errors.ratio && (
                    <p className="text-xs text-destructive">{errors.ratio}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="grind">Molienda *</Label>
                  <Select 
                    value={formData.grind} 
                    onValueChange={(grind) => updateFormData({ grind })}
                  >
                    <SelectTrigger className={errors.grind ? "border-destructive" : ""}>
                      <SelectValue placeholder="Ej: Media-fina" />
                    </SelectTrigger>
                    <SelectContent>
                      {GRIND_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.grind && (
                    <p className="text-xs text-destructive">{errors.grind}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coffee-amount">Café (g) *</Label>
                  <Input
                    id="coffee-amount"
                    placeholder="Ej: 18g"
                    value={formData.coffeeAmount}
                    onChange={(e) => updateFormData({ coffeeAmount: e.target.value })}
                    className={errors.coffeeAmount ? "border-destructive" : ""}
                  />
                  {errors.coffeeAmount && (
                    <p className="text-xs text-destructive">{errors.coffeeAmount}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="water-amount">Agua (ml) *</Label>
                  <Input
                    id="water-amount"
                    placeholder="Ej: 375ml"
                    value={formData.waterAmount}
                    onChange={(e) => updateFormData({ waterAmount: e.target.value })}
                    className={errors.waterAmount ? "border-destructive" : ""}
                  />
                  {errors.waterAmount && (
                    <p className="text-xs text-destructive">{errors.waterAmount}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Tiempo *</Label>
                  <Input
                    id="time"
                    placeholder="Ej: 3:30"
                    value={formData.time}
                    onChange={(e) => updateFormData({ time: e.target.value })}
                    className={errors.time ? "border-destructive" : ""}
                  />
                  {errors.time && (
                    <p className="text-xs text-destructive">{errors.time}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperatura *</Label>
                  <Input
                    id="temperature"
                    placeholder="Ej: 94°C"
                    value={formData.temperature}
                    onChange={(e) => updateFormData({ temperature: e.target.value })}
                    className={errors.temperature ? "border-destructive" : ""}
                  />
                  {errors.temperature && (
                    <p className="text-xs text-destructive">{errors.temperature}</p>
                  )}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">Rangos sugeridos para {formData.method}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                  <div>Ratio: 1:15-1:17</div>
                  <div>Temperatura: 92-96°C</div>
                  <div>Tiempo: 3:00-4:00</div>
                  <div>Molienda: Media</div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6 p-1">
              <StepsList
                steps={formData.steps}
                onChange={(steps) => updateFormData({ steps })}
              />
              {errors.steps && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.steps}
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notas de preparación</Label>
                <Textarea
                  id="notes"
                  placeholder="Observaciones adicionales, consejos especiales..."
                  value={formData.notes}
                  onChange={(e) => updateFormData({ notes: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">Adjuntos (opcional)</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Puedes agregar fotos o enlaces a videos demostrativos
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled>
                    📷 Agregar foto
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    🎥 Enlace video
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <Button variant="outline" onClick={prevStep}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
            )}
            
            <Button
              variant="ghost"
              onClick={() => handleSave(true)}
              className="text-muted-foreground"
            >
              <Save className="h-4 w-4 mr-2" />
              Guardar borrador
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {currentStep === 3 && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-review"
                  checked={formData.sendForReview}
                  onCheckedChange={(checked) => 
                    updateFormData({ sendForReview: Boolean(checked) })
                  }
                />
                <Label htmlFor="send-review" className="text-sm">
                  Enviar para revisión del encargado
                </Label>
              </div>
            )}

            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>

            {currentStep < 3 ? (
              <Button onClick={nextStep}>
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={() => handleSave(false)}>
                <Check className="h-4 w-4 mr-2" />
                {mode === "edit" ? "Actualizar" : "Crear receta"}
              </Button>
            )}
          </div>
        </div>

        {currentStep === 3 && formData.sendForReview && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Tu receta se envía para revisión. Una vez aprobada, podrás activarla para todo el equipo.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}