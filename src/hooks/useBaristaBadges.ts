import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, startOfMonth, subDays } from "date-fns";

export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earned: boolean;
  earnedAt?: string;
  progress?: number;
  maxProgress?: number;
};

export function useBaristaBadges(baristaId?: string) {
  return useQuery({
    queryKey: ['barista-badges', baristaId],
    queryFn: async (): Promise<Badge[]> => {
      if (!baristaId) return [];

      const badges: Badge[] = [];
      const today = new Date();
      const weekStart = startOfWeek(today);
      const monthStart = startOfMonth(today);
      const last7Days = subDays(today, 7);

      // Obtener todas las calibraciones del barista
      const { data: allCals, error: allError } = await supabase
        .from('calibration_entries')
        .select('approved, created_at, fecha')
        .eq('barista_id', baristaId)
        .order('created_at', { ascending: false });

      if (allError) throw allError;

      const totalCals = allCals?.length || 0;
      const approvedCals = allCals?.filter(c => c.approved).length || 0;

      // Badge 1: Primera Calibración
      const firstCal = allCals?.[allCals.length - 1];
      badges.push({
        id: 'first_calibration',
        name: 'Primera Calibración',
        description: 'Registraste tu primera calibración',
        icon: '🎓',
        color: 'text-blue-500',
        earned: totalCals > 0,
        earnedAt: firstCal?.created_at,
      });

      // Badge 2: Novato (10 calibraciones)
      badges.push({
        id: 'novice',
        name: 'Barista Novato',
        description: 'Completa 10 calibraciones',
        icon: '☕',
        color: 'text-amber-500',
        earned: totalCals >= 10,
        progress: Math.min(totalCals, 10),
        maxProgress: 10,
      });

      // Badge 3: Experto (50 calibraciones)
      badges.push({
        id: 'expert',
        name: 'Barista Experto',
        description: 'Completa 50 calibraciones',
        icon: '🏆',
        color: 'text-yellow-500',
        earned: totalCals >= 50,
        progress: Math.min(totalCals, 50),
        maxProgress: 50,
      });

      // Badge 4: Maestro (100 calibraciones)
      badges.push({
        id: 'master',
        name: 'Maestro del Café',
        description: 'Completa 100 calibraciones',
        icon: '👑',
        color: 'text-purple-500',
        earned: totalCals >= 100,
        progress: Math.min(totalCals, 100),
        maxProgress: 100,
      });

      // Badge 5: Perfeccionista (80% aprobación con 20+ calibraciones)
      const successRate = totalCals > 0 ? (approvedCals / totalCals) * 100 : 0;
      badges.push({
        id: 'perfectionist',
        name: 'Perfeccionista',
        description: '80% de calibraciones aprobadas (mín. 20)',
        icon: '💎',
        color: 'text-cyan-500',
        earned: totalCals >= 20 && successRate >= 80,
        progress: totalCals >= 20 ? Math.min(successRate, 100) : 0,
        maxProgress: 100,
      });

      // Badge 6: Racha semanal
      const { data: weekCals } = await supabase
        .from('calibration_entries')
        .select('created_at')
        .eq('barista_id', baristaId)
        .gte('fecha', weekStart.toISOString());

      const weekCount = weekCals?.length || 0;
      badges.push({
        id: 'weekly_streak',
        name: 'Racha Semanal',
        description: '7 calibraciones en una semana',
        icon: '🔥',
        color: 'text-orange-500',
        earned: weekCount >= 7,
        progress: Math.min(weekCount, 7),
        maxProgress: 7,
      });

      // Badge 7: Consistencia (5 días seguidos con al menos 1 calibración)
      const uniqueDaysLast7 = new Set(
        allCals
          ?.filter(c => new Date(c.fecha) >= last7Days)
          .map(c => c.fecha)
      ).size;

      badges.push({
        id: 'consistency',
        name: 'Consistente',
        description: 'Calibra 5 días seguidos',
        icon: '📅',
        color: 'text-green-500',
        earned: uniqueDaysLast7 >= 5,
        progress: uniqueDaysLast7,
        maxProgress: 5,
      });

      // Badge 8: Madrugador (calibración antes de las 8am)
      const earlyBird = allCals?.some(c => {
        const hour = new Date(c.created_at).getHours();
        return hour < 8;
      });

      badges.push({
        id: 'early_bird',
        name: 'Madrugador',
        description: 'Calibra antes de las 8am',
        icon: '🌅',
        color: 'text-pink-500',
        earned: earlyBird || false,
      });

      return badges;
    },
    enabled: !!baristaId,
  });
}
