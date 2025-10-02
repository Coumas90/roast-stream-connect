import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LocationStockItem {
  id: string;
  location_id: string;
  coffee_variety_id: string;
  hopper_number: number;
  current_kg: number;
  last_refill_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  coffee_varieties: {
    id: string;
    name: string;
    category: string;
    price_per_kg?: number;
    image_url?: string;
    origin?: string;
    description?: string;
    specifications?: any;
  };
}

export function useLocationStock(locationId?: string) {
  return useQuery({
    queryKey: ['location_stock', locationId],
    queryFn: async () => {
      if (!locationId) return [];
      
      const { data, error } = await supabase
        .from('location_stock')
        .select(`
          *,
          coffee_varieties(id, name, category, price_per_kg, image_url, origin, description, specifications)
        `)
        .eq('location_id', locationId)
        .order('hopper_number');
      
      if (error) throw error;
      return data as LocationStockItem[];
    },
    enabled: !!locationId,
  });
}

export function useStockMetrics(locationId?: string) {
  const { data: stock, isLoading } = useLocationStock(locationId);
  
  return {
    totalStock: stock?.reduce((sum, item) => sum + item.current_kg, 0) || 0,
    inventoryValue: stock?.reduce((sum, item) => 
      sum + (item.current_kg * (item.coffee_varieties?.price_per_kg || 0)), 0) || 0,
    lowStockItems: stock?.filter(item => item.current_kg < 5) || [],
    lastRefillDate: stock?.reduce((latest, item) => {
      const refillDate = item.last_refill_at ? new Date(item.last_refill_at) : null;
      return refillDate && (!latest || refillDate > latest) ? refillDate : latest;
    }, null as Date | null),
    isLoading,
    stockItems: stock || []
  };
}