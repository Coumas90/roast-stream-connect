
import React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const schema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  code: z.string().min(1, "Código requerido").regex(/^[A-Z0-9_-]+$/, "Use mayúsculas, números, guiones o guion bajo"),
  timezone: z.string().min(2, "Zona horaria requerida"),
});

export type LocationFormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultValues?: Partial<LocationFormValues>;
  loading?: boolean;
  onSubmit: (values: LocationFormValues) => Promise<void>;
  title?: string;
  description?: string;
  submitText?: string;
};

export default function LocationFormDialog({
  open,
  onOpenChange,
  defaultValues,
  loading,
  onSubmit,
  title = "Nueva Sucursal",
  description = "Crea una sucursal con código y zona horaria",
  submitText = "Guardar",
}: Props) {
  const form = useForm<LocationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", code: "", timezone: "America/Argentina/Buenos_Aires", ...defaultValues },
  });

  React.useEffect(() => {
    form.reset({
      name: defaultValues?.name ?? "",
      code: defaultValues?.code ?? "",
      timezone: defaultValues?.timezone ?? "America/Argentina/Buenos_Aires",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues, open]);

  const handleSubmit = async (values: LocationFormValues) => {
    await onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Sucursal Centro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código</FormLabel>
                  <FormControl>
                    <Input placeholder="CENTRO-01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zona Horaria</FormLabel>
                  <FormControl>
                    <Input placeholder="America/Argentina/Buenos_Aires" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{submitText}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
