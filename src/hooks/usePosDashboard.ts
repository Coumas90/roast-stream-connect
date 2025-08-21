import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DashboardData {
  summary: {
    health_score: number;
    health_status: string;
    expirations_critical: number;
    expirations_warning: number;
    breakers_open: number;
    avg_mttr_minutes: number;
    mttr_status: string;
  };
  expirations: any[];
  mttr_details: any[];
  breaker_status: any[];
  timestamp: string;
}

export function usePosDashboard() {
  return useQuery({
    queryKey: ["pos_dashboard"],
    queryFn: async (): Promise<DashboardData> => {
      const { data, error } = await supabase.functions.invoke("pos-dashboard", {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (error) {
        console.error("Error fetching POS dashboard:", error);
        throw error;
      }

      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    retry: 2,
  });
}