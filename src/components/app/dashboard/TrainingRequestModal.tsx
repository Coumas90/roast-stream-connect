import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useCreateTrainingRequest, TrainingType, TrainingPriority } from "@/hooks/useTrainingRequests";

const formSchema = z.object({
  training_type: z.enum(['barista_basics', 'latte_art', 'coffee_cupping', 'equipment_maintenance', 'custom']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  estimated_duration_hours: z.number().min(1).max(40),
  estimated_days: z.number().min(1).max(10),
  preferred_date: z.string().optional(),
  specific_topics: z.array(z.string()),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface TrainingRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationId: string;
}

const trainingTypes: { value: TrainingType; label: string }[] = [
  { value: 'barista_basics', label: 'Fundamentos de Barista' },
  { value: 'latte_art', label: 'Latte Art' },
  { value: 'coffee_cupping', label: 'Catación de Café' },
  { value: 'equipment_maintenance', label: 'Mantenimiento de Equipos' },
  { value: 'custom', label: 'Capacitación Personalizada' },
];

const priorities: { value: TrainingPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Baja', color: 'bg-gray-500' },
  { value: 'medium', label: 'Media', color: 'bg-yellow-500' },
  { value: 'high', label: 'Alta', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgente', color: 'bg-red-500' },
];

const availableTopics = [
  'Preparación de espresso',
  'Técnicas de vaporizado de leche',
  'Arte en café (latte art)',
  'Calibración de molino',
  'Limpieza y mantenimiento',
  'Atención al cliente',
  'Catación y análisis sensorial',
  'Métodos de preparación alternativos',
  'Control de calidad',
  'Gestión de inventario',
];

export function TrainingRequestModal({ isOpen, onClose, locationId }: TrainingRequestModalProps) {
  const createMutation = useCreateTrainingRequest();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      training_type: 'barista_basics',
      priority: 'medium',
      estimated_duration_hours: 4,
      estimated_days: 1,
      specific_topics: [],
      notes: '',
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate({
      ...data,
      location_id: locationId,
    }, {
      onSuccess: () => {
        form.reset();
        onClose();
      }
    });
  };

  const specificTopics = form.watch('specific_topics');

  const handleTopicToggle = (topic: string) => {
    const currentTopics = specificTopics || [];
    const updatedTopics = currentTopics.includes(topic)
      ? currentTopics.filter(t => t !== topic)
      : [...currentTopics, topic];
    form.setValue('specific_topics', updatedTopics);
  };

  const removeTopic = (topic: string) => {
    const currentTopics = specificTopics || [];
    form.setValue('specific_topics', currentTopics.filter(t => t !== topic));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Solicitar Capacitación</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="training_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Capacitación</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona el tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {trainingTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridad</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona la prioridad" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {priorities.map((priority) => (
                          <SelectItem key={priority.value} value={priority.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${priority.color}`} />
                              {priority.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="estimated_duration_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duración (horas)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1" 
                        max="40"
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estimated_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Días necesarios</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1" 
                        max="10"
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="preferred_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha preferida</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="specific_topics"
              render={() => (
                <FormItem>
                  <FormLabel>Temas Específicos</FormLabel>
                  <div className="space-y-3">
                    {specificTopics.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {specificTopics.map((topic) => (
                          <Badge key={topic} variant="secondary" className="flex items-center gap-1">
                            {topic}
                            <button
                              type="button"
                              onClick={() => removeTopic(topic)}
                              className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {availableTopics.map((topic) => (
                        <div key={topic} className="flex items-center space-x-2">
                          <Checkbox
                            id={topic}
                            checked={specificTopics.includes(topic)}
                            onCheckedChange={() => handleTopicToggle(topic)}
                          />
                          <label 
                            htmlFor={topic} 
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {topic}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas Adicionales</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe cualquier requerimiento específico o contexto adicional..."
                      className="min-h-20"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="flex-1"
              >
                {createMutation.isPending ? "Enviando..." : "Enviar Solicitud"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}