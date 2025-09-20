import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/lib/tenant';

export interface RecipeStep {
  id?: string;
  order: number;
  title: string;
  description: string;
  time_minutes?: number;
  water_ml?: number;
  time?: string;
  water?: string;
}

export interface DatabaseRecipe {
  id: string;
  name: string;
  method?: string;
  description?: string;
  status: 'draft' | 'published' | 'review' | 'archived';
  type: 'personal' | 'team' | 'official' | 'template';
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
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  tenant_id?: string;
  params?: any;
  steps?: RecipeStep[];
}

// UI compatible Recipe interface
export interface Recipe extends DatabaseRecipe {
  // Additional UI fields for compatibility
  coffee: string; // Required for UI - computed from coffee_amount
  isActive?: boolean; // Computed from is_active
  coffee_name?: string;
  coffee_origin?: string;
}

export interface CreateRecipeData {
  name: string;
  method?: string;
  description?: string;
  status?: 'draft' | 'published' | 'review';
  type?: 'personal' | 'team' | 'official' | 'template';
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
  params?: any;
  steps?: Omit<RecipeStep, 'id'>[];
}

// Hook to fetch recipes with optional filters
export function useRecipes(filters?: {
  status?: string;
  type?: string;
  method?: string;
  search?: string;
}) {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['recipes', filters, tenantId],
    queryFn: async () => {
      let query = supabase
        .from('recipes')
        .select(`
          *,
          coffee_varieties(name, category, origin)
        `)
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
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Transform data to match the Recipe interface
      return (data || []).map(recipe => ({
        ...recipe,
        coffee_name: recipe.coffee_varieties?.name || recipe.custom_coffee_name || 'Custom Coffee',
        coffee_origin: recipe.coffee_varieties?.origin || recipe.custom_coffee_origin || '',
        coffee: recipe.coffee_amount || '', // Always provide a default value
        isActive: recipe.is_active,
        created_at: recipe.created_at,
        updated_at: recipe.updated_at,
      })) as Recipe[];
    },
  });
}

// Hook to fetch a single recipe by ID
export function useRecipe(id: string) {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: async () => {
      const { data: recipe, error } = await supabase
        .from('recipes')
        .select(`
          *,
          coffee_varieties(name, category, origin),
          recipe_steps(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!recipe) return null;

      // Fetch creator profile separately if created_by exists
      let creatorProfile = null;
      if (recipe.created_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', recipe.created_by)
          .single();

        creatorProfile = profile;
      }

      // Transform data to match the Recipe interface
      return {
        ...recipe,
        coffee_name: recipe.coffee_varieties?.name || recipe.custom_coffee_name || 'Custom Coffee',
        coffee_origin: recipe.coffee_varieties?.origin || recipe.custom_coffee_origin || '',
        coffee: recipe.coffee_amount || '', // Always provide a default value
        isActive: recipe.is_active,
        creator_name: creatorProfile?.full_name || null,
        steps: recipe.recipe_steps?.sort((a, b) => a.step_order - b.step_order).map(step => ({
          id: step.id,
          order: step.step_order,
          title: step.title,
          description: step.description,
          time_minutes: step.time_minutes,
          water_ml: step.water_ml,
          time: step.time_minutes?.toString(),
          water: step.water_ml?.toString(),
        })) || [],
      } as Recipe;
    },
    enabled: !!id,
  });
}

// Hook to create a new recipe
export function useCreateRecipe() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async (recipeData: CreateRecipeData & { isAdminGlobal?: boolean }) => {
      // Determine if this is a global admin recipe (no tenant_id)
      const finalTenantId = recipeData.isAdminGlobal ? null : tenantId;
      
      // Create the recipe
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          name: recipeData.name,
          description: recipeData.description,
          method: recipeData.method,
          status: recipeData.status || 'draft',
          type: recipeData.type || 'personal',
          coffee_type: recipeData.coffee_type || 'tupa',
          coffee_variety_id: recipeData.coffee_variety_id,
          custom_coffee_name: recipeData.custom_coffee_name,
          custom_coffee_origin: recipeData.custom_coffee_origin,
          coffee_amount: recipeData.coffee_amount,
          water_amount: recipeData.water_amount,
          ratio: recipeData.ratio,
          temperature: recipeData.temperature,
          grind: recipeData.grind,
          time: recipeData.time,
          notes: recipeData.notes,
          params: recipeData.params || {},
          tenant_id: finalTenantId,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (recipeError) throw recipeError;

      // Create recipe steps if provided
      if (recipeData.steps && recipeData.steps.length > 0) {
        const stepsToInsert = recipeData.steps.map((step, index) => ({
          recipe_id: recipe.id,
          title: step.title,
          description: step.description,
          step_order: index + 1,
          time_minutes: step.time_minutes || (step.time ? parseInt(step.time) : null),
          water_ml: step.water_ml || (step.water ? parseInt(step.water) : null),
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
        title: "Recipe created",
        description: "Your recipe has been created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating recipe:', error);
      toast({
        title: "Error creating recipe",
        description: error.message || "There was an error creating your recipe",
        variant: "destructive",
      });
    },
  });
}

// Hook to update an existing recipe
export function useUpdateRecipe() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: string; 
      updates: Partial<CreateRecipeData>;
    }) => {
      // Update the recipe
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .update({
          name: updates.name,
          description: updates.description,
          method: updates.method,
          status: updates.status,
          type: updates.type,
          coffee_type: updates.coffee_type,
          coffee_variety_id: updates.coffee_variety_id,
          custom_coffee_name: updates.custom_coffee_name,
          custom_coffee_origin: updates.custom_coffee_origin,
          coffee_amount: updates.coffee_amount,
          water_amount: updates.water_amount,
          ratio: updates.ratio,
          temperature: updates.temperature,
          grind: updates.grind,
          time: updates.time,
          notes: updates.notes,
          params: updates.params,
        })
        .eq('id', id)
        .select()
        .single();

      if (recipeError) throw recipeError;

      // Update recipe steps if provided
      if (updates.steps) {
        // Delete existing steps
        await supabase
          .from('recipe_steps')
          .delete()
          .eq('recipe_id', id);

        // Insert new steps
        if (updates.steps.length > 0) {
          const stepsToInsert = updates.steps.map((step, index) => ({
            recipe_id: id,
            title: step.title,
            description: step.description,
            step_order: index + 1,
            time_minutes: step.time_minutes || (step.time ? parseInt(step.time) : null),
            water_ml: step.water_ml || (step.water ? parseInt(step.water) : null),
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
      queryClient.invalidateQueries({ queryKey: ['recipe'] });
      
      toast({
        title: "Recipe updated",
        description: "Your recipe has been updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating recipe:', error);
      toast({
        title: "Error updating recipe",
        description: error.message || "There was an error updating your recipe",
        variant: "destructive",
      });
    },
  });
}

// Hook to toggle the active status of a recipe
export function useToggleRecipeActive() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      // If activating this recipe, first deactivate all others
      if (isActive) {
        await supabase
          .from('recipes')
          .update({ is_active: false })
          .neq('id', id);
      }

      // Update the target recipe
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
        title: isActive ? "Recipe activated" : "Recipe deactivated",
        description: isActive 
          ? "Recipe is now the active recipe" 
          : "Recipe has been deactivated",
      });
    },
    onError: (error) => {
      console.error('Error toggling recipe:', error);
      toast({
        title: "Error",
        description: error.message || "There was an error updating the recipe",
        variant: "destructive",
      });
    },
  });
}

// Hook to duplicate a recipe
export function useDuplicateRecipe() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (recipeId: string) => {
      // Get the original recipe with steps
      const { data: originalRecipe, error: fetchError } = await supabase
        .from('recipes')
        .select(`
          *,
          recipe_steps(*)
        `)
        .eq('id', recipeId)
        .single();

      if (fetchError) throw fetchError;

      // Create the duplicated recipe
      const { data: newRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          ...originalRecipe,
          id: undefined, // Let Supabase generate a new ID
          name: `${originalRecipe.name} (Copy)`,
          is_active: false, // Don't activate the copy
          created_at: undefined,
          updated_at: undefined,
        })
        .select()
        .single();

      if (recipeError) throw recipeError;

      // Duplicate the steps
      if (originalRecipe.recipe_steps && originalRecipe.recipe_steps.length > 0) {
        const stepsToInsert = originalRecipe.recipe_steps.map(step => ({
          ...step,
          id: undefined, // Let Supabase generate a new ID
          recipe_id: newRecipe.id,
          created_at: undefined,
          updated_at: undefined,
        }));

        const { error: stepsError } = await supabase
          .from('recipe_steps')
          .insert(stepsToInsert);

        if (stepsError) throw stepsError;
      }

      return newRecipe;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      
      toast({
        title: "Recipe duplicated",
        description: "Recipe has been duplicated successfully",
      });
    },
    onError: (error) => {
      console.error('Error duplicating recipe:', error);
      toast({
        title: "Error duplicating recipe",
        description: error.message || "There was an error duplicating the recipe",
        variant: "destructive",
      });
    },
  });
}

// Hook to archive or unarchive a recipe
export function useArchiveRecipe() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      id, 
      archive 
    }: { 
      id: string; 
      archive: boolean;
    }) => {
      const { data, error } = await supabase
        .from('recipes')
        .update({ 
          status: archive ? 'archived' : 'draft',
          active: !archive 
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { archive }) => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      
      toast({
        title: archive ? "Recipe archived" : "Recipe restored",
        description: archive 
          ? "Recipe has been archived" 
          : "Recipe has been restored from archive",
      });
    },
    onError: (error) => {
      console.error('Error archiving recipe:', error);
      toast({
        title: "Error",
        description: error.message || "There was an error updating the recipe",
        variant: "destructive",
      });
    },
  });
}

// Hook to share a recipe (simulated)
export function useShareRecipe() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      recipeId, 
      shareType, 
      emails, 
      message 
    }: { 
      recipeId: string; 
      shareType: 'link' | 'email' | 'team';
      emails?: string[];
      message?: string;
    }) => {
      // Simulate sharing logic
      // In a real app, this would call an API endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return { 
        success: true, 
        shareType, 
        recipientCount: emails?.length || 0 
      };
    },
    onSuccess: (data) => {
      const { shareType, recipientCount } = data;
      let description = "Recipe has been shared successfully";
      
      if (shareType === 'email') {
        description = `Recipe sent to ${recipientCount} recipients`;
      } else if (shareType === 'team') {
        description = "Recipe has been shared with the team";
      }
      
      toast({
        title: "Recipe shared",
        description,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not share the recipe",
        variant: "destructive",
      });
    },
  });
}