import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CoffeeVariety {
  id: string;
  name: string;
  description?: string;
  origin?: string;
  category: string;
  price_per_kg?: number;
  available_bulk: boolean;
  available_packaged: boolean;
  specifications?: Record<string, any>;
  image_url?: string;
  active: boolean;
}

export function useCoffeeVarieties(options?: {
  activeOnly?: boolean;
  category?: string;
  availableOnly?: boolean;
  searchTerm?: string;
}) {
  return useQuery({
    queryKey: ['coffee_varieties', options],
    queryFn: async () => {
      let query = supabase
        .from('coffee_varieties')
        .select('*')
        .order('category')
        .order('name');

      if (options?.activeOnly !== false) {
        query = query.eq('active', true);
      }

      if (options?.category) {
        query = query.eq('category', options.category);
      }

      if (options?.availableOnly) {
        query = query.or('available_bulk.eq.true,available_packaged.eq.true');
      }

      if (options?.searchTerm) {
        query = query.or(`name.ilike.%${options.searchTerm}%,description.ilike.%${options.searchTerm}%,origin.ilike.%${options.searchTerm}%`);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as CoffeeVariety[];
    },
  });
}

// Hook for location stock info
export function useLocationStock(locationId?: string) {
  return useQuery({
    queryKey: ['location_stock', locationId],
    queryFn: async () => {
      if (!locationId) return [];
      
      const { data, error } = await supabase
        .from('location_stock')
        .select(`
          *,
          coffee_varieties(name, category)
        `)
        .eq('location_id', locationId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!locationId,
  });
}

export function useTupaCoffees() {
  return useCoffeeVarieties({ 
    activeOnly: true, 
    category: 'tupa' 
  });
}