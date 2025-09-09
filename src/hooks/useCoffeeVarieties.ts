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
}) {
  return useQuery({
    queryKey: ['coffee_varieties', options],
    queryFn: async () => {
      let query = supabase
        .from('coffee_varieties')
        .select('*')
        .order('name');

      if (options?.activeOnly !== false) {
        query = query.eq('active', true);
      }

      if (options?.category) {
        query = query.eq('category', options.category);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as CoffeeVariety[];
    },
  });
}

export function useTupaCoffees() {
  return useCoffeeVarieties({ 
    activeOnly: true, 
    category: 'tupa' 
  });
}