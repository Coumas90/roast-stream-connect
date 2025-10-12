import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CalibrationMetrics {
  total_calibrations: number;
  avg_time_s: number;
  avg_temp_c: number;
  avg_ratio: number;
  unique_baristas: number;
  baristas: Array<{
    id: string;
    name: string;
    count: number;
  }>;
  recent_calibrations: Array<{
    id: string;
    fecha: string;
    turno: string;
    barista_name: string;
    time_s: number;
    temp_c: number;
    ratio_calc: number;
    approved: boolean;
  }>;
}

export function useRecipeCalibrations(recipeId?: string) {
  return useQuery({
    queryKey: ["recipe-calibrations", recipeId],
    queryFn: async (): Promise<CalibrationMetrics> => {
      if (!recipeId) {
        return {
          total_calibrations: 0,
          avg_time_s: 0,
          avg_temp_c: 0,
          avg_ratio: 0,
          unique_baristas: 0,
          baristas: [],
          recent_calibrations: [],
        };
      }

      const { data: calibrations, error } = await supabase
        .from("calibration_entries")
        .select(`
          id,
          fecha,
          turno,
          time_s,
          temp_c,
          ratio_calc,
          approved,
          barista_id,
          profiles:barista_id (
            full_name
          )
        `)
        .eq("recipe_id", recipeId)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      const total = calibrations?.length || 0;
      
      if (total === 0) {
        return {
          total_calibrations: 0,
          avg_time_s: 0,
          avg_temp_c: 0,
          avg_ratio: 0,
          unique_baristas: 0,
          baristas: [],
          recent_calibrations: [],
        };
      }

      // Calculate averages
      const avgTime = calibrations.reduce((sum, c) => sum + (c.time_s || 0), 0) / total;
      const avgTemp = calibrations.reduce((sum, c) => sum + (c.temp_c || 0), 0) / total;
      const avgRatio = calibrations.reduce((sum, c) => sum + (c.ratio_calc || 0), 0) / total;

      // Count unique baristas
      const baristaMap = new Map<string, { id: string; name: string; count: number }>();
      calibrations.forEach((cal) => {
        const baristaId = cal.barista_id;
        const baristaName = (cal.profiles as any)?.full_name || "Sin nombre";
        
        if (baristaMap.has(baristaId)) {
          baristaMap.get(baristaId)!.count++;
        } else {
          baristaMap.set(baristaId, { id: baristaId, name: baristaName, count: 1 });
        }
      });

      const baristas = Array.from(baristaMap.values()).sort((a, b) => b.count - a.count);

      // Recent calibrations (last 10)
      const recent = calibrations.slice(0, 10).map((cal) => ({
        id: cal.id,
        fecha: cal.fecha,
        turno: cal.turno,
        barista_name: (cal.profiles as any)?.full_name || "Sin nombre",
        time_s: cal.time_s || 0,
        temp_c: cal.temp_c || 0,
        ratio_calc: cal.ratio_calc || 0,
        approved: cal.approved || false,
      }));

      return {
        total_calibrations: total,
        avg_time_s: Math.round(avgTime),
        avg_temp_c: Math.round(avgTemp * 10) / 10,
        avg_ratio: Math.round(avgRatio * 100) / 100,
        unique_baristas: baristaMap.size,
        baristas,
        recent_calibrations: recent,
      };
    },
    enabled: !!recipeId,
  });
}
