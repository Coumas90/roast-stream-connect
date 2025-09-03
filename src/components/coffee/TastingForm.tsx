import React from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Control } from "react-hook-form";

interface TastingFormProps {
  control: Control<any>;
}

const tastingFields = [
  { name: "sweetness", label: "Dulzor", max: 10 },
  { name: "aroma", label: "Fragancia/Aroma", max: 10 },
  { name: "flavor", label: "Sabor", max: 10 },
  { name: "aftertaste", label: "Retrogusto", max: 10 },
  { name: "acidity", label: "Acidez", max: 10 },
  { name: "body", label: "Cuerpo", max: 10 },
  { name: "balance", label: "Balance", max: 10 },
  { name: "overall", label: "General", max: 10 },
  { name: "uniformity", label: "Uniformidad", max: 10 },
  { name: "clean_cup", label: "Taza Limpia", max: 10 },
  { name: "defects", label: "Defectos", max: 10 },
];

export function TastingForm({ control }: TastingFormProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Análisis Sensorial</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tastingFields.map((field) => (
            <FormField
              key={field.name}
              control={control}
              name={`specifications.tasting.${field.name}`}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel className="flex justify-between">
                    {field.label}
                    <span className="text-sm text-muted-foreground">
                      {formField.value || 0}/{field.max}
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Slider
                      min={0}
                      max={field.max}
                      step={0.1}
                      value={[formField.value || 0]}
                      onValueChange={(values) => formField.onChange(values[0])}
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="specifications.technical.region"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Región</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Huila, Colombia" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="specifications.technical.varietal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Varietal</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Caturra, Geisha" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="specifications.technical.process"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Proceso</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Lavado, Honey, Natural" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="specifications.technical.altitude"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Altitud (msnm)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  placeholder="1500" 
                  {...field}
                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="specifications.technical.score"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Puntaje Total</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.1"
                  max="100"
                  placeholder="85.5" 
                  {...field}
                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="specifications.technical.harvest"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Zafra</FormLabel>
              <FormControl>
                <Input placeholder="2024" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="specifications.tasting.notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notas de Cata</FormLabel>
            <FormControl>
              <Textarea 
                placeholder="Describe los sabores, aromas y características del café..."
                className="min-h-[120px]"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="specifications.technical.practices"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Prácticas Agrícolas</FormLabel>
            <FormControl>
              <Textarea 
                placeholder="Prácticas de cultivo, certificaciones, etc."
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}