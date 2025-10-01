import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant";

export interface ActiveRecipe {
  id: string;
  name: string;
  method: string;
  coffee_name: string;
  coffee_origin: string;
  target_dose_g: number;
  target_yield_value: number;
  target_yield_unit: string;
  target_time_min: number;
  target_time_max: number;
  target_temp_c: number;
  target_ratio_min: number;
  target_ratio_max: number;
}

export function useActiveRecipes(locationId?: string) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ["active-recipes", locationId, tenantId],
    queryFn: async () => {
      if (!locationId && !tenantId) return [];

      let query = supabase
        .from("recipes")
        .select(`
          *,
          coffee_varieties(name, origin)
        `)
        .eq("method", "espresso")
        .eq("is_active", true)
        .in("status", ["published", "draft"])
        .order("name");

      // Filter by location or tenant
      if (locationId) {
        // For now, we'll use tenant_id since recipes don't have location_id
        // In future, we could add location-specific recipes
        query = query.eq("tenant_id", tenantId);
      } else if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform to ActiveRecipe format with defaults
      return (data || []).map((recipe): ActiveRecipe => {
        const coffeeName = recipe.coffee_varieties?.name || recipe.custom_coffee_name || "Café TUPÁ";
        const coffeeOrigin = recipe.coffee_varieties?.origin || recipe.custom_coffee_origin || "";

        // Parse text fields to numbers, with sensible defaults
        const doseG = recipe.coffee_amount ? parseFloat(recipe.coffee_amount) : 18;
        const yieldValue = recipe.water_amount ? parseFloat(recipe.water_amount) : 36;
        const tempC = recipe.temperature ? parseFloat(recipe.temperature) : 93;
        
        // Calculate ratio range based on recipe or use defaults
        const ratio = recipe.ratio ? parseFloat(recipe.ratio) : 2.0;
        const ratioMin = ratio - 0.2;
        const ratioMax = ratio + 0.2;

        // Time range from recipe or defaults
        const timeS = recipe.time ? parseInt(recipe.time) : 28;
        const timeMin = Math.max(15, timeS - 3);
        const timeMax = Math.min(60, timeS + 4);

        return {
          id: recipe.id,
          name: recipe.name,
          method: recipe.method || "espresso",
          coffee_name: coffeeName,
          coffee_origin: coffeeOrigin,
          target_dose_g: doseG,
          target_yield_value: yieldValue,
          target_yield_unit: "g",
          target_time_min: timeMin,
          target_time_max: timeMax,
          target_temp_c: tempC,
          target_ratio_min: ratioMin,
          target_ratio_max: ratioMax,
        };
      });
    },
    enabled: !!(locationId || tenantId),
  });
}
