import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { useCreateTrainingFeedback, CreateTrainingFeedback } from "@/hooks/useTrainingFeedback";
import { TrainingRequest } from "@/hooks/useTrainingRequests";

interface TrainingFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainingRequest: TrainingRequest;
}

const RatingInput = ({ 
  label, 
  value, 
  onChange 
}: { 
  label: string; 
  value: number; 
  onChange: (value: number) => void; 
}) => {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-1 hover:scale-110 transition-transform"
          >
            <Star
              className={`h-6 w-6 ${
                star <= value
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300 hover:text-yellow-300"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export function TrainingFeedbackModal({ 
  isOpen, 
  onClose, 
  trainingRequest 
}: TrainingFeedbackModalProps) {
  const [formData, setFormData] = React.useState<CreateTrainingFeedback>({
    training_request_id: trainingRequest.id,
    overall_rating: 0,
    content_rating: 0,
    instructor_rating: 0,
    venue_rating: 0,
    what_learned: "",
    suggestions: "",
    additional_comments: "",
  });

  const [startTime] = React.useState(Date.now());
  const createFeedbackMutation = useCreateTrainingFeedback();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const completionTime = Math.round((Date.now() - startTime) / 1000 / 60); // minutes
    
    createFeedbackMutation.mutate({
      ...formData,
      completion_time_minutes: completionTime,
    });
    
    onClose();
  };

  const isValid = formData.overall_rating > 0 && 
                  formData.content_rating > 0 && 
                  formData.instructor_rating > 0 && 
                  formData.venue_rating > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Feedback de Capacitación</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Ayúdanos a mejorar compartiendo tu experiencia sobre: {trainingRequest.training_type}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rating Questions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RatingInput
              label="Calificación General"
              value={formData.overall_rating}
              onChange={(value) => setFormData(prev => ({ ...prev, overall_rating: value }))}
            />
            
            <RatingInput
              label="Calidad del Contenido"
              value={formData.content_rating}
              onChange={(value) => setFormData(prev => ({ ...prev, content_rating: value }))}
            />
            
            <RatingInput
              label="Instructor"
              value={formData.instructor_rating}
              onChange={(value) => setFormData(prev => ({ ...prev, instructor_rating: value }))}
            />
            
            <RatingInput
              label="Lugar/Instalaciones"
              value={formData.venue_rating}
              onChange={(value) => setFormData(prev => ({ ...prev, venue_rating: value }))}
            />
          </div>

          {/* Text Questions */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="what_learned">¿Qué aprendiste en esta capacitación?</Label>
              <Textarea
                id="what_learned"
                placeholder="Describe los conocimientos o habilidades que adquiriste..."
                value={formData.what_learned}
                onChange={(e) => setFormData(prev => ({ ...prev, what_learned: e.target.value }))}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="suggestions">¿Qué sugerencias tienes para mejorar?</Label>
              <Textarea
                id="suggestions"
                placeholder="Comparte ideas para hacer la capacitación aún mejor..."
                value={formData.suggestions}
                onChange={(e) => setFormData(prev => ({ ...prev, suggestions: e.target.value }))}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="additional_comments">Comentarios adicionales (opcional)</Label>
              <Textarea
                id="additional_comments"
                placeholder="Cualquier otro comentario que quieras compartir..."
                value={formData.additional_comments}
                onChange={(e) => setFormData(prev => ({ ...prev, additional_comments: e.target.value }))}
                className="mt-2"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!isValid || createFeedbackMutation.isPending}
            >
              {createFeedbackMutation.isPending ? "Enviando..." : "Enviar Feedback"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}