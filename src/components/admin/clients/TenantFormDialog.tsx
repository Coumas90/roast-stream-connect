
import React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const schema = z.object({
  name: z.string().min(2, "Nombre demasiado corto"),
  slug: z.string().min(2, "Slug requerido").regex(/^[a-z0-9-]+$/, "Use minúsculas, números y guiones"),
});

export type TenantFormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultValues?: Partial<TenantFormValues>;
  loading?: boolean;
  onSubmit: (values: TenantFormValues) => Promise<void>;
  title?: string;
  description?: string;
  submitText?: string;
};

export default function TenantFormDialog({
  open,
  onOpenChange,
  defaultValues,
  loading,
  onSubmit,
  title = "Nuevo Cliente",
  description = "Crea un tenant (cliente) con nombre y slug",
  submitText = "Guardar",
}: Props) {
  const form = useForm<TenantFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", slug: "", ...defaultValues },
  });

  React.useEffect(() => {
    form.reset({ name: defaultValues?.name ?? "", slug: defaultValues?.slug ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues, open]);

  const handleSubmit = async (values: TenantFormValues) => {
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
                    <Input placeholder="Cafeterías del Sol" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input placeholder="cafeterias-del-sol" {...field} />
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
