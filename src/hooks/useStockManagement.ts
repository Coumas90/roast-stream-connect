import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpsertHopperStockParams {
  locationId: string;
  hopperNumber: number;
  coffeeVarietyId: string;
}

interface DeleteHopperStockParams {
  locationId: string;
  hopperNumber: number;
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
    onSuccess: async (data, variables) => {
      console.log('[UPSERT] Resetting all location_stock queries for location:', variables.locationId);
      // Resetear TODAS las queries relacionadas con location_stock para forzar re-render en todos los componentes
      await queryClient.resetQueries({ 
        queryKey: ['location_stock'],
        exact: false 
      });
      console.log('[UPSERT] Queries reset successfully');
      toast.success('Tolvas configuradas correctamente');
    },
    onError: (error) => {
      console.error('Error updating hopper stock:', error);
      toast.error('Error al configurar las tolvas');
    },
  });

  const deleteHopperStock = useMutation({
    mutationFn: async ({ locationId, hopperNumber }: DeleteHopperStockParams) => {
      console.log('Deleting hopper stock:', { locationId, hopperNumber });
      
      const { error } = await supabase
        .from('location_stock')
        .delete()
        .eq('location_id', locationId)
        .eq('hopper_number', hopperNumber);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Hopper stock deleted successfully');
    },
    onSuccess: async (data, variables) => {
      console.log('[DELETE] Resetting all location_stock queries for location:', variables.locationId);
      // Resetear TODAS las queries relacionadas con location_stock para forzar re-render en todos los componentes
      await queryClient.resetQueries({ 
        queryKey: ['location_stock'],
        exact: false 
      });
      console.log('[DELETE] Queries reset successfully');
      toast.success('Tolva eliminada correctamente');
    },
    onError: (error) => {
      console.error('Error deleting hopper stock:', error);
      toast.error('Error al eliminar la tolva');
    },
  });

  return {
    upsertHopperStock,
    deleteHopperStock,
  };
}
