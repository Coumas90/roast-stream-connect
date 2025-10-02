import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpsertHopperStockParams {
  locationId: string;
  hopperNumber: number;
  coffeeVarietyId: string;
}

export function useStockManagement() {
  const queryClient = useQueryClient();

  const upsertHopperStock = useMutation({
    mutationFn: async ({ locationId, hopperNumber, coffeeVarietyId }: UpsertHopperStockParams) => {
      console.log('Upserting hopper stock:', { locationId, hopperNumber, coffeeVarietyId });
      
      const { data, error } = await supabase
        .from('location_stock')
        .upsert(
          {
            location_id: locationId,
            hopper_number: hopperNumber,
            coffee_variety_id: coffeeVarietyId,
            current_kg: 0,
            last_refill_at: new Date().toISOString(),
          },
          {
            onConflict: 'location_id,hopper_number',
          }
        )
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Hopper stock upserted successfully:', data);
      return data;
    },
    onSuccess: (data, variables) => {
      console.log('Invalidating queries for location:', variables.locationId);
      // Invalidar tanto las queries genéricas como las específicas por location
      queryClient.invalidateQueries({ queryKey: ['location_stock'] });
      queryClient.invalidateQueries({ queryKey: ['location_stock', variables.locationId] });
      toast.success('Tolvas configuradas correctamente');
    },
    onError: (error) => {
      console.error('Error updating hopper stock:', error);
      toast.error('Error al configurar las tolvas');
    },
  });

  return {
    upsertHopperStock,
  };
}
