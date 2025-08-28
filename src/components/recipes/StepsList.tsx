import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { 
  GripVertical, 
  Plus, 
  Trash2, 
  Clock, 
  Droplets 
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface RecipeStep {
  id: string;
  order: number;
  title: string;
  description: string;
  time?: string;
  water?: string;
}

interface StepsListProps {
  steps: RecipeStep[];
  onChange: (steps: RecipeStep[]) => void;
  className?: string;
}

export function StepsList({ steps, onChange, className }: StepsListProps) {
  const [draggedStep, setDraggedStep] = useState<string | null>(null);

  const addStep = () => {
    const newStep: RecipeStep = {
      id: `step-${Date.now()}`,
      order: steps.length + 1,
      title: "",
      description: "",
    };
    onChange([...steps, newStep]);
  };

  const updateStep = (stepId: string, updates: Partial<RecipeStep>) => {
    onChange(
      steps.map(step => 
        step.id === stepId ? { ...step, ...updates } : step
      )
    );
  };

  const removeStep = (stepId: string) => {
    const newSteps = steps
      .filter(step => step.id !== stepId)
      .map((step, index) => ({ ...step, order: index + 1 }));
    onChange(newSteps);
  };

  const handleDragStart = (e: React.DragEvent, stepId: string) => {
    setDraggedStep(stepId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetStepId: string) => {
    e.preventDefault();
    
    if (!draggedStep || draggedStep === targetStepId) {
      setDraggedStep(null);
      return;
    }

    const draggedIndex = steps.findIndex(step => step.id === draggedStep);
    const targetIndex = steps.findIndex(step => step.id === targetStepId);
    
    const newSteps = [...steps];
    const [draggedItem] = newSteps.splice(draggedIndex, 1);
    newSteps.splice(targetIndex, 0, draggedItem);
    
    // Reorder all steps
    const reorderedSteps = newSteps.map((step, index) => ({
      ...step,
      order: index + 1
    }));
    
    onChange(reorderedSteps);
    setDraggedStep(null);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          Pasos de preparación *
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addStep}
          className="text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Agregar paso
        </Button>
      </div>

      {steps.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              No hay pasos definidos
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addStep}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar primer paso
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {steps.map((step, index) => (
            <Card
              key={step.id}
              className={cn(
                "transition-all duration-200",
                draggedStep === step.id && "opacity-50 scale-95"
              )}
              draggable
              onDragStart={(e) => handleDragStart(e, step.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, step.id)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    Paso {step.order}
                  </div>
                  <div className="flex-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeStep(step.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <Input
                      placeholder="Ej: Bloom inicial"
                      value={step.title}
                      onChange={(e) => updateStep(step.id, { title: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Tiempo"
                      value={step.time || ""}
                      onChange={(e) => updateStep(step.id, { time: e.target.value })}
                      className="text-sm"
                    />
                    <Input
                      placeholder="Agua (ml)"
                      value={step.water || ""}
                      onChange={(e) => updateStep(step.id, { water: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                </div>

                <Textarea
                  placeholder="Describe acciones simples y medibles. Ej: 'Bloom 45s con 60ml'"
                  value={step.description}
                  onChange={(e) => updateStep(step.id, { description: e.target.value })}
                  className="text-sm resize-none"
                  rows={2}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {steps.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Arrastra los pasos para reordenarlos. Se requiere al menos un paso.
        </p>
      )}
    </div>
  );
}