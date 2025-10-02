import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CalibrationEntry = {
  id: string;
  fecha: string;
  created_at: string;
  coffee_profile_id: string | null;
  recipe_id: string | null;
  coffee_name: string | null;
  recipe_name: string | null;
  dose_g: number;
  yield_value: number;
  time_s: number;
  temp_c: number;
  ratio_calc: number | null;
  approved: boolean;
  turno: string;
  notes_tags: string[] | null;
};

export function useRecentCalibrations(baristaId?: string, limit = 5) {
  return useQuery({
    queryKey: ['recent-calibrations', baristaId, limit],
    queryFn: async (): Promise<CalibrationEntry[]> => {
      if (!baristaId) return [];

      const { data, error } = await supabase
        .from('calibration_entries')
        .select(`
          id,
          fecha,
          created_at,
          coffee_profile_id,
          recipe_id,
          dose_g,
          yield_value,
          time_s,
          temp_c,
          ratio_calc,
          approved,
          turno,
          notes_tags,
          coffee_profiles!inner(name),
          recipes(name)
        `)
        .eq('barista_id', baristaId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(entry => ({
        ...entry,
        coffee_name: entry.coffee_profiles?.name || null,
        recipe_name: entry.recipes?.name || null,
      })) as CalibrationEntry[];
    },
    enabled: !!baristaId,
  });
}
