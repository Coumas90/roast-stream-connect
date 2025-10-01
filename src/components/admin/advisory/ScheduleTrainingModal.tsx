import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { TrainingRequest } from "@/hooks/useTrainingRequests";

const scheduleSchema = z.object({
  scheduled_at: z.date({
    message: "La fecha de programación es requerida.",
  }),
  notes: z.string().optional(),
});

type ScheduleFormValues = z.infer<typeof scheduleSchema>;

interface ScheduleTrainingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: TrainingRequest | null;
  onSchedule: (id: string, data: ScheduleFormValues) => void;
}

export function ScheduleTrainingModal({
  open,
  onOpenChange,
  request,
  onSchedule,
}: ScheduleTrainingModalProps) {
  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      scheduled_at: request?.preferred_date ? new Date(request.preferred_date) : undefined,
      notes: "",
    },
  });

  React.useEffect(() => {
    if (request) {
      form.reset({
        scheduled_at: request.preferred_date ? new Date(request.preferred_date) : undefined,
        notes: "",
      });
    }
  }, [request, form]);

  const onSubmit = (data: ScheduleFormValues) => {
    if (request) {
      onSchedule(request.id, data);
      onOpenChange(false);
      form.reset();
    }
  };

  const trainingTypeLabels = {
    barista_basics: "Fundamentos de Barista",
    latte_art: "Arte Latte",
    coffee_cupping: "Catación de Café",
    equipment_maintenance: "Mantenimiento de Equipos",
    custom: "Personalizada",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Programar Capacitación</DialogTitle>
          <DialogDescription>
            {request && (
              <>
                Programar la capacitación de <strong>{trainingTypeLabels[request.training_type]}</strong>
                <br />
                Duración estimada: {request.estimated_duration_hours}h ({request.estimated_days} días)
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="scheduled_at"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha y Hora de Capacitación</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: es })
                          ) : (
                            <span>Seleccionar fecha</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date()
                        }
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas de Programación</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detalles adicionales sobre la programación..."
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Programar Capacitación
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}