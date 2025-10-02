import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LocationStockItemReadonly {
  id: string;
  location_id: string;
  coffee_variety_id: string;
  hopper_number: number;
  current_kg: number;
  last_refill_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Coffee variety fields (denormalized, no price!)
  coffee_id: string | null;
  coffee_name: string | null;
  coffee_category: string | null;
  coffee_image_url: string | null;
  coffee_origin: string | null;
  coffee_description: string | null;
  coffee_specifications: any | null;
}

export function useLocationStockReadonly(locationId?: string) {
  return useQuery({
    queryKey: ['location_stock_readonly', locationId],
    queryFn: async () => {
      if (!locationId) return [];
      
      const { data, error } = await supabase
        .from('location_stock_readonly')
        .select('*')
        .eq('location_id', locationId)
        .order('hopper_number');
      
      if (error) throw error;
      return data as LocationStockItemReadonly[];
    },
    enabled: !!locationId,
  });
}

export function useStockMetricsReadonly(locationId?: string) {
  const { data: stock, isLoading } = useLocationStockReadonly(locationId);
  
  return {
    totalStock: stock?.reduce((sum, item) => sum + item.current_kg, 0) || 0,
    lowStockItems: stock?.filter(item => item.current_kg < 5) || [],
    lastRefillDate: stock?.reduce((latest, item) => {
      const refillDate = item.last_refill_at ? new Date(item.last_refill_at) : null;
      return refillDate && (!latest || refillDate > latest) ? refillDate : latest;
    }, null as Date | null),
    isLoading,
    stockItems: stock || []
  };
}
