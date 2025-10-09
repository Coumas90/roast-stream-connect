import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RecipeDependencies {
  hasCalibrations: boolean;
  calibrationCount: number;
  hasProfiles: boolean;
  profileCount: number;
  canDelete: boolean;
}

export function useRecipeDependencies(recipeId?: string) {
  return useQuery({
    queryKey: ["recipe-dependencies", recipeId],
    queryFn: async (): Promise<RecipeDependencies> => {
      if (!recipeId) {
        return {
          hasCalibrations: false,
          calibrationCount: 0,
          hasProfiles: false,
          profileCount: 0,
          canDelete: true,
        };
      }

      // Check calibration entries
      const { count: calibrationCount, error: calibrationError } = await supabase
        .from("calibration_entries")
        .select("*", { count: "exact", head: true })
        .eq("recipe_id", recipeId);

      if (calibrationError) throw calibrationError;

      // Check coffee profiles
      const { count: profileCount, error: profileError } = await supabase
        .from("coffee_profiles")
        .select("*", { count: "exact", head: true })
        .eq("recipe_id", recipeId);

      if (profileError) throw profileError;

      const hasCalibrations = (calibrationCount ?? 0) > 0;
      const hasProfiles = (profileCount ?? 0) > 0;

      return {
        hasCalibrations,
        calibrationCount: calibrationCount ?? 0,
        hasProfiles,
        profileCount: profileCount ?? 0,
        canDelete: !hasCalibrations && !hasProfiles,
      };
    },
    enabled: !!recipeId,
  });
}
