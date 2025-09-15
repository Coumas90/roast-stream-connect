import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrderProposal {
  id: string;
  tenant_id: string;
  location_id: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'delivered';
  items: any;
  proposed_at: string;
  created_by: string | null;
  coffee_variety: string | null;
  notes: string | null;
  delivery_type: string | null;
  odoo_so_number: string | null;
  source: string;
}

export function useOrderHistory(locationId?: string, limit = 10) {
  return useQuery({
    queryKey: ['order_history', locationId, limit],
    queryFn: async () => {
      if (!locationId) return [];
      
      const { data, error } = await supabase
        .from('order_proposals')
        .select('*')
        .eq('location_id', locationId)
        .order('proposed_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as OrderProposal[];
    },
    enabled: !!locationId,
  });
}

export function useOrderMetrics(locationId?: string) {
  const { data: orders, isLoading } = useOrderHistory(locationId, 50);
  
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const recentOrders = orders?.filter(order => 
    new Date(order.proposed_at) >= thirtyDaysAgo
  ) || [];
  
  return {
    pendingOrders: orders?.filter(order => 
      ['draft', 'pending', 'approved'].includes(order.status)
    ).length || 0,
    recentOrdersCount: recentOrders.length,
    lastOrderDate: orders?.[0]?.proposed_at || null,
    ordersByStatus: orders?.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {},
    isLoading,
    orders: orders || []
  };
}