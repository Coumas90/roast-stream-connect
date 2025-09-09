import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface RecipeStep {
  id?: string;
  order: number;
  title: string;
  description: string;
  time?: string;
  water?: string;
}

export interface DatabaseRecipe {
  id: string;
  name: string;
  method?: string;
  description?: string;
  status: 'draft' | 'active' | 'review' | 'archived';
  type: 'personal' | 'team' | 'oficial' | 'template';
  ratio?: string;
  coffee_amount?: string;
  water_amount?: string;
  time?: string;
  temperature?: string;
  grind?: string;
  coffee_type?: 'tupa' | 'other';
  coffee_variety_id?: string;
  custom_coffee_name?: string;
  custom_coffee_origin?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  tenant_id?: string;
  steps?: RecipeStep[];
}

// UI compatible Recipe interface
export interface Recipe extends DatabaseRecipe {
  // Additional UI fields for compatibility
  coffee?: string; // Computed from coffee_amount
  isActive?: boolean; // Computed from is_active
}

export interface CreateRecipeData {
  name: string;
  method?: string;
  description?: string;
  status?: 'draft' | 'active' | 'review';
  type?: 'personal' | 'team' | 'oficial';
  ratio?: string;
  coffee_amount?: string;
  water_amount?: string;
  time?: string;
  temperature?: string;
  grind?: string;
  coffee_type?: 'tupa' | 'other';
  coffee_variety_id?: string;
  custom_coffee_name?: string;
  custom_coffee_origin?: string;
  notes?: string;
  steps?: Omit<RecipeStep, 'id'>[];
}

// Hook to fetch recipes
export function useRecipes(filters?: {
  status?: string;
  type?: string;
  method?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['recipes', filters],
    queryFn: async () => {
      let query = supabase
        .from('recipes')
        .select(`
          *,
          recipe_steps (
            id,
            step_order,
            title,
            description,
            time_minutes,
            water_ml
          )
        `)
        .eq('active', true)
        .order('updated_at', { ascending: false });

      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.method) {
        query = query.eq('method', filters.method);
      }
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      // Transform recipe_steps to match our interface
      return data?.map(recipe => ({
        ...recipe,
        // Add UI compatibility fields
        coffee: recipe.coffee_amount || "",
        isActive: recipe.is_active,
        steps: recipe.recipe_steps?.map(step => ({
          id: step.id,
          order: step.step_order,
          title: step.title,
          description: step.description,
          time: step.time_minutes?.toString(),
          water: step.water_ml?.toString(),
        })) || []
      })) || [];
    },
  });
}

// Hook to get a single recipe
export function useRecipe(id: string) {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          *,
          recipe_steps (
            id,
            step_order,
            title,
            description,
            time_minutes,
            water_ml
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;

      return {
        ...data,
        // Add UI compatibility fields
        coffee: data.coffee_amount || "",
        isActive: data.is_active,
        steps: data.recipe_steps?.map(step => ({
          id: step.id,
          order: step.step_order,
          title: step.title,
          description: step.description,
          time: step.time_minutes?.toString(),
          water: step.water_ml?.toString(),
        })) || []
      };
    },
    enabled: !!id,
  });
}

// Hook to create a recipe
export function useCreateRecipe() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateRecipeData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user's default tenant
      const { data: profile } = await supabase
        .from('profiles')
        .select('default_tenant_id')
        .eq('id', user.id)
        .single();

      const { steps, ...recipeData } = data;

      // Create the recipe
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          ...recipeData,
          created_by: user.id,
          tenant_id: data.type === 'personal' ? null : profile?.default_tenant_id,
        })
        .select()
        .single();

      if (recipeError) throw recipeError;

      // Create recipe steps if any
      if (steps && steps.length > 0) {
        const stepsToInsert = steps.map((step, index) => ({
          recipe_id: recipe.id,
          step_order: index + 1,
          title: step.title,
          description: step.description,
          time_minutes: step.time ? parseInt(step.time) : null,
          water_ml: step.water ? parseInt(step.water) : null,
        }));

        const { error: stepsError } = await supabase
          .from('recipe_steps')
          .insert(stepsToInsert);

        if (stepsError) throw stepsError;
      }

      return recipe;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast({
        title: "Receta creada",
        description: "Tu receta ha sido guardada exitosamente",
      });
    },
    onError: (error) => {
      console.error('Error creating recipe:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la receta. Intenta de nuevo.",
        variant: "destructive",
      });
    },
  });
}

// Hook to update a recipe
export function useUpdateRecipe() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateRecipeData> }) => {
      const { steps, ...recipeData } = data;

      // Update the recipe
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .update(recipeData)
        .eq('id', id)
        .select()
        .single();

      if (recipeError) throw recipeError;

      // Update steps if provided
      if (steps) {
        // Delete existing steps
        await supabase
          .from('recipe_steps')
          .delete()
          .eq('recipe_id', id);

        // Insert new steps
        if (steps.length > 0) {
          const stepsToInsert = steps.map((step, index) => ({
            recipe_id: id,
            step_order: index + 1,
            title: step.title,
            description: step.description,
            time_minutes: step.time ? parseInt(step.time) : null,
            water_ml: step.water ? parseInt(step.water) : null,
          }));

          const { error: stepsError } = await supabase
            .from('recipe_steps')
            .insert(stepsToInsert);

          if (stepsError) throw stepsError;
        }
      }

      return recipe;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast({
        title: "Receta actualizada",
        description: "Los cambios han sido guardados",
      });
    },
    onError: (error) => {
      console.error('Error updating recipe:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la receta",
        variant: "destructive",
      });
    },
  });
}

// Hook to toggle recipe active status
export function useToggleRecipeActive() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      // If activating this recipe, deactivate all others first
      if (isActive) {
        await supabase
          .from('recipes')
          .update({ is_active: false })
          .neq('id', id);
      }

      const { data, error } = await supabase
        .from('recipes')
        .update({ is_active: isActive })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast({
        title: isActive ? "Receta activada" : "Receta desactivada",
        description: isActive ? "Esta receta ahora está activa" : "La receta ha sido desactivada",
      });
    },
  });
}

// Hook to duplicate a recipe
export function useDuplicateRecipe() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (originalId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get the original recipe with steps
      const { data: original, error: fetchError } = await supabase
        .from('recipes')
        .select(`
          *,
          recipe_steps (*)
        `)
        .eq('id', originalId)
        .single();

      if (fetchError) throw fetchError;

      // Create duplicate recipe
      const { data: duplicate, error: createError } = await supabase
        .from('recipes')
        .insert({
          ...original,
          id: undefined,
          name: `${original.name} (Copia)`,
          created_by: user.id,
          is_active: false,
          status: 'draft',
          type: 'personal',
        })
        .select()
        .single();

      if (createError) throw createError;

      // Duplicate steps
      if (original.recipe_steps && original.recipe_steps.length > 0) {
        const stepsToInsert = original.recipe_steps.map(step => ({
          recipe_id: duplicate.id,
          step_order: step.step_order,
          title: step.title,
          description: step.description,
          time_minutes: step.time_minutes,
          water_ml: step.water_ml,
        }));

        const { error: stepsError } = await supabase
          .from('recipe_steps')
          .insert(stepsToInsert);

        if (stepsError) throw stepsError;
      }

      return duplicate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast({
        title: "Receta duplicada",
        description: "Se ha creado una copia de la receta",
      });
    },
  });
}