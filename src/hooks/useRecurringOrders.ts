import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface RecurringOrder {
  id: string;
  tenant_id: string;
  location_id: string;
  created_by: string | null;
  enabled: boolean;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  day_of_week: number | null;
  items: Array<{
    variety: string;
    quantity: number;
    unit: string;
    type: 'ground' | 'product';
  }>;
  delivery_type: string | null;
  notes: string | null;
  next_order_date: string | null;
  last_order_date: string | null;
  created_at: string;
  updated_at: string;
}

export function useRecurringOrders(locationId?: string) {
  return useQuery({
    queryKey: ['recurring_orders', locationId],
    queryFn: async () => {
      if (!locationId) return null;
      
      const { data, error } = await supabase
        .from('recurring_orders')
        .select('*')
        .eq('location_id', locationId)
        .maybeSingle();
      
      if (error) throw error;
      return data as RecurringOrder | null;
    },
    enabled: !!locationId,
  });
}

export function useUpdateRecurringOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Partial<RecurringOrder> & { location_id: string; tenant_id: string }) => {
      const { data: result, error } = await supabase
        .from('recurring_orders')
        .upsert({
          ...data,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['recurring_orders', data.location_id] });
      toast({
        title: "Configuración guardada",
        description: "Los pedidos automáticos han sido configurados correctamente"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la configuración",
        variant: "destructive"
      });
    }
  });
}

export function useToggleRecurringOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { data, error } = await supabase
        .from('recurring_orders')
        .update({ enabled })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['recurring_orders', data.location_id] });
      toast({
        title: data.enabled ? "Pedidos automáticos activados" : "Pedidos automáticos desactivados",
        description: data.enabled 
          ? "Los pedidos se crearán automáticamente según la configuración"
          : "Los pedidos automáticos han sido pausados"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar el estado",
        variant: "destructive"
      });
    }
  });
}