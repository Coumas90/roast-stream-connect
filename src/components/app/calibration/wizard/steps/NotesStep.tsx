import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCalibrationSettings } from "@/hooks/useCalibrationSettings";
import { WizardState } from "../CalibrationWizard";

interface NotesStepProps {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

export function NotesStep({ state, updateState, onNext, onPrevious }: NotesStepProps) {
  const { data: settings } = useCalibrationSettings();

  const quickNotes = settings?.quick_notes_chips || [
    "ácido",
    "amargo",
    "equilibrado",
    "dulce",
    "astringente",
    "sub-extraído",
    "sobre-extraído",
  ];

  const toggleNoteTag = (tag: string) => {
    const current = state.notesTags || [];
    updateState({
      notesTags: current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag],
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold mb-2">Notas de Cata</h2>
        <p className="text-muted-foreground">
          Registra las características del espresso extraído.
        </p>
      </div>

      {/* Quick Notes Chips */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Notas rápidas</Label>
        <div className="flex flex-wrap gap-2">
          {quickNotes.map((note) => (
            <Badge
              key={note}
              variant={state.notesTags.includes(note) ? "default" : "outline"}
              className="cursor-pointer touch-manipulation text-sm py-2 px-4 hover-scale"
              onClick={() => toggleNoteTag(note)}
            >
              {note}
            </Badge>
          ))}
        </div>
      </div>

      {/* Additional Notes */}
      <div className="space-y-2">
        <Label>Notas adicionales (opcional)</Label>
        <Textarea
          value={state.notesText}
          onChange={(e) => updateState({ notesText: e.target.value })}
          placeholder="Describe cualquier observación adicional sobre la extracción..."
          rows={5}
          className="resize-none"
        />
        <div className="text-xs text-muted-foreground text-right">
          {state.notesText.length} caracteres
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onPrevious} className="flex-1 h-12">
          <ChevronLeft className="w-5 h-5 mr-2" />
          Anterior
        </Button>
        <Button onClick={onNext} className="flex-1 h-12">
          Revisar
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
