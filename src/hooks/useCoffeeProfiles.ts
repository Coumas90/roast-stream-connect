import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ConsumptionAugmentedDatabase } from "@/integrations/supabase/types.augment";

type CoffeeProfile = ConsumptionAugmentedDatabase["public"]["Tables"]["coffee_profiles"]["Row"];
type CoffeeProfileInsert = ConsumptionAugmentedDatabase["public"]["Tables"]["coffee_profiles"]["Insert"];

export function useCoffeeProfiles(locationId?: string) {
  return useQuery({
    queryKey: ["coffee-profiles", locationId],
    queryFn: async () => {
      let query = supabase
        .from("coffee_profiles")
        .select("*, grinders(name)")
        .eq("active", true)
        .order("name");

      if (locationId) {
        query = query.eq("location_id", locationId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as (CoffeeProfile & { grinders?: { name: string } | null })[];
    },
    enabled: !!locationId,
  });
}

export function useCreateCoffeeProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CoffeeProfileInsert) => {
      const { data: result, error } = await supabase
        .from("coffee_profiles")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coffee-profiles"] });
      toast({
        title: "Perfil creado",
        description: "El perfil de café se creó exitosamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
