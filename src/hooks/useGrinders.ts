import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ConsumptionAugmentedDatabase } from "@/integrations/supabase/types.augment";

type Grinder = ConsumptionAugmentedDatabase["public"]["Tables"]["grinders"]["Row"];

export function useGrinders(locationId?: string) {
  return useQuery({
    queryKey: ["grinders", locationId],
    queryFn: async () => {
      let query = supabase
        .from("grinders")
        .select("*")
        .eq("active", true)
        .order("name");

      if (locationId) {
        query = query.eq("location_id", locationId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Grinder[];
    },
    enabled: !!locationId,
  });
}
