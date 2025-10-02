import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

export type BaristaInsight = {
  type: 'tip' | 'warning' | 'achievement';
  icon: string;
  title: string;
  message: string;
  priority: number;
};

export function useBaristaInsights(baristaId?: string) {
  return useQuery({
    queryKey: ['barista-insights', baristaId],
    queryFn: async (): Promise<BaristaInsight[]> => {
      if (!baristaId) return [];

      const insights: BaristaInsight[] = [];
      const last7Days = subDays(new Date(), 7);

      // Obtener calibraciones recientes
      const { data: recentCals, error } = await supabase
        .from('calibration_entries')
        .select('approved, time_s, ratio_calc, notes_tags, created_at')
        .eq('barista_id', baristaId)
        .gte('fecha', last7Days.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      if (!recentCals || recentCals.length === 0) {
        insights.push({
          type: 'tip',
          icon: '📝',
          title: 'Comienza a calibrar',
          message: 'Registra tu primera calibración del día para mejorar la consistencia.',
          priority: 1,
        });
        return insights;
      }

      // Análisis 1: Tasa de aprobación baja
      const approvedCount = recentCals.filter(c => c.approved).length;
      const successRate = (approvedCount / recentCals.length) * 100;

      if (successRate < 60) {
        insights.push({
          type: 'warning',
          icon: '⚠️',
          title: 'Tasa de aprobación baja',
          message: `${successRate.toFixed(0)}% de tus últimas calibraciones fueron aprobadas. Revisa los parámetros target.`,
          priority: 3,
        });
      }

      // Análisis 2: Patrones en tiempo de extracción
      const avgTime = recentCals.reduce((sum, c) => sum + c.time_s, 0) / recentCals.length;
      const timeVariance = recentCals.reduce((sum, c) => sum + Math.abs(c.time_s - avgTime), 0) / recentCals.length;

      if (timeVariance > 5) {
        insights.push({
          type: 'tip',
          icon: '⏱️',
          title: 'Inconsistencia en tiempos',
          message: 'Tus tiempos varían mucho. Mantén la molienda consistente y verifica el peso de dosis.',
          priority: 2,
        });
      }

      // Análisis 3: Patrones en notas de sabor
      const allTags = recentCals.flatMap(c => c.notes_tags || []);
      const acidCount = allTags.filter(t => t.toLowerCase().includes('ácido') || t.toLowerCase().includes('sub-extraído')).length;
      const bitterCount = allTags.filter(t => t.toLowerCase().includes('amargo') || t.toLowerCase().includes('sobre-extraído')).length;

      if (acidCount > 3) {
        insights.push({
          type: 'tip',
          icon: '🔧',
          title: 'Tendencia a sub-extracción',
          message: 'Has marcado "ácido" varias veces. Considera cerrar molienda 0.3-0.5 puntos.',
          priority: 2,
        });
      }

      if (bitterCount > 3) {
        insights.push({
          type: 'tip',
          icon: '🌡️',
          title: 'Tendencia a sobre-extracción',
          message: 'Has marcado "amargo" varias veces. Intenta abrir molienda o reducir temperatura 1°C.',
          priority: 2,
        });
      }

      // Análisis 4: Racha de aprobaciones
      const last5 = recentCals.slice(0, 5);
      const last5Approved = last5.filter(c => c.approved).length;

      if (last5Approved === 5) {
        insights.push({
          type: 'achievement',
          icon: '🎯',
          title: '¡Excelente racha!',
          message: 'Tus últimas 5 calibraciones fueron aprobadas. ¡Sigue así!',
          priority: 1,
        });
      }

      // Análisis 5: Consistencia en ratio
      const ratios = recentCals.filter(c => c.ratio_calc !== null).map(c => c.ratio_calc as number);
      if (ratios.length >= 5) {
        const avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
        const ratioStdDev = Math.sqrt(
          ratios.reduce((sum, r) => sum + Math.pow(r - avgRatio, 2), 0) / ratios.length
        );

        if (ratioStdDev < 0.15) {
          insights.push({
            type: 'achievement',
            icon: '📊',
            title: 'Ratios consistentes',
            message: `Mantienes ratios muy consistentes (promedio ${avgRatio.toFixed(2)}). ¡Gran trabajo!`,
            priority: 1,
          });
        }
      }

      // Si no hay problemas, agregar un tip general
      if (insights.length === 0 && successRate >= 80) {
        insights.push({
          type: 'tip',
          icon: '💡',
          title: 'Mantén el enfoque',
          message: 'Excelente trabajo. Continúa registrando todas tus calibraciones para mantener la calidad.',
          priority: 1,
        });
      }

      return insights.sort((a, b) => b.priority - a.priority);
    },
    enabled: !!baristaId,
  });
}
