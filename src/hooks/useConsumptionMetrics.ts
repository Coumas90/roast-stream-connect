import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConsumptionData {
  id: string;
  client_id: string;
  location_id: string;
  provider: string;
  date: string;
  total: number;
  orders: number;
  items: number;
  discounts: number;
  taxes: number;
  meta: any;
  created_at: string;
  updated_at: string;
}

export function useConsumptionData(locationId?: string, days = 30) {
  return useQuery({
    queryKey: ['consumption_data', locationId, days],
    queryFn: async () => {
      if (!locationId) return [];
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const { data, error } = await supabase
        .from('consumptions')
        .select('*')
        .eq('location_id', locationId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data as ConsumptionData[];
    },
    enabled: !!locationId,
  });
}

export function useConsumptionMetrics(locationId?: string) {
  const { data: consumption, isLoading } = useConsumptionData(locationId);
  
  const monthlyConsumption = consumption?.reduce((sum, item) => sum + item.total, 0) || 0;
  const dailyAverage = consumption?.length ? monthlyConsumption / consumption.length : 0;
  
  // Simulated coffee consumption calculation (assuming $1000 monthly = ~15kg coffee)
  const estimatedCoffeeKg = monthlyConsumption / 67; // Rough estimate: $67 per kg
  
  return {
    monthlyRevenue: monthlyConsumption,
    dailyAverage,
    totalOrders: consumption?.reduce((sum, item) => sum + item.orders, 0) || 0,
    totalItems: consumption?.reduce((sum, item) => sum + item.items, 0) || 0,
    estimatedCoffeeKg: Math.round(estimatedCoffeeKg),
    isLoading,
    consumptionData: consumption || []
  };
}