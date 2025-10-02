import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, subDays } from "date-fns";

export type BaristaMetrics = {
  todayCalibrations: number;
  todayApproved: number;
  successRate: number;
  weeklyCalibrations: number;
  lastCalibrationTime: string | null;
};

export function useBaristaMetrics(baristaId?: string) {
  return useQuery({
    queryKey: ['barista-metrics', baristaId],
    queryFn: async (): Promise<BaristaMetrics> => {
      if (!baristaId) {
        return {
          todayCalibrations: 0,
          todayApproved: 0,
          successRate: 0,
          weeklyCalibrations: 0,
          lastCalibrationTime: null,
        };
      }

      const today = new Date();
      const weekAgo = subDays(today, 7);

      // Get today's calibrations
      const { data: todayData, error: todayError } = await supabase
        .from('calibration_entries')
        .select('id, approved, created_at')
        .eq('barista_id', baristaId)
        .gte('fecha', startOfDay(today).toISOString())
        .lte('fecha', endOfDay(today).toISOString());

      if (todayError) throw todayError;

      // Get weekly calibrations for success rate
      const { data: weeklyData, error: weeklyError } = await supabase
        .from('calibration_entries')
        .select('id, approved')
        .eq('barista_id', baristaId)
        .gte('fecha', weekAgo.toISOString());

      if (weeklyError) throw weeklyError;

      // Get last calibration time
      const { data: lastCalib, error: lastError } = await supabase
        .from('calibration_entries')
        .select('created_at')
        .eq('barista_id', baristaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastError && lastError.code !== 'PGRST116') throw lastError;

      const todayCalibrations = todayData?.length || 0;
      const todayApproved = todayData?.filter(c => c.approved).length || 0;
      const weeklyCalibrations = weeklyData?.length || 0;
      const weeklyApproved = weeklyData?.filter(c => c.approved).length || 0;
      const successRate = weeklyCalibrations > 0 
        ? Math.round((weeklyApproved / weeklyCalibrations) * 100) 
        : 0;

      return {
        todayCalibrations,
        todayApproved,
        successRate,
        weeklyCalibrations,
        lastCalibrationTime: lastCalib?.created_at || null,
      };
    },
    enabled: !!baristaId,
  });
}
