import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ConsumptionAugmentedDatabase } from "@/integrations/supabase/types.augment";

type CalibrationEntry = ConsumptionAugmentedDatabase["public"]["Tables"]["calibration_entries"]["Row"];
type CalibrationEntryInsert = ConsumptionAugmentedDatabase["public"]["Tables"]["calibration_entries"]["Insert"];
type CalibrationEntryUpdate = ConsumptionAugmentedDatabase["public"]["Tables"]["calibration_entries"]["Update"];

export function useCalibrationEntries(coffeeProfileId?: string, recipeId?: string, fecha?: string) {
  return useQuery({
    queryKey: ["calibration-entries", coffeeProfileId, recipeId, fecha],
    queryFn: async () => {
      let query = supabase
        .from("calibration_entries")
        .select("*")
        .order("created_at", { ascending: false });

      if (coffeeProfileId) {
        query = query.eq("coffee_profile_id", coffeeProfileId);
      }

      if (recipeId) {
        query = query.eq("recipe_id", recipeId);
      }

      if (fecha) {
        query = query.eq("fecha", fecha);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as CalibrationEntry[];
    },
    enabled: !!(coffeeProfileId || recipeId),
  });
}

export function useTodayCalibrations(coffeeProfileId?: string, recipeId?: string, turno?: string) {
  const today = new Date().toISOString().split('T')[0];
  
  return useQuery({
    queryKey: ["calibration-today-all", coffeeProfileId, recipeId, turno, today],
    queryFn: async () => {
      if ((!coffeeProfileId && !recipeId) || !turno) return [];

      let query = supabase
        .from("calibration_entries")
        .select("*")
        .eq("fecha", today)
        .eq("turno", turno)
        .order("created_at", { ascending: false });

      if (coffeeProfileId) {
        query = query.eq("coffee_profile_id", coffeeProfileId);
      } else if (recipeId) {
        query = query.eq("recipe_id", recipeId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as CalibrationEntry[];
    },
    enabled: !!(coffeeProfileId || recipeId) && !!turno,
  });
}

export function useTodayApprovedEntry(coffeeProfileId?: string, recipeId?: string, turno?: string) {
  const today = new Date().toISOString().split('T')[0];
  
  return useQuery({
    queryKey: ["calibration-approved-today", coffeeProfileId, recipeId, turno, today],
    queryFn: async () => {
      if ((!coffeeProfileId && !recipeId) || !turno) return null;

      let query = supabase
        .from("calibration_entries")
        .select("*")
        .eq("fecha", today)
        .eq("turno", turno)
        .eq("approved", true);

      if (coffeeProfileId) {
        query = query.eq("coffee_profile_id", coffeeProfileId);
      } else if (recipeId) {
        query = query.eq("recipe_id", recipeId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return data as CalibrationEntry | null;
    },
    enabled: !!(coffeeProfileId || recipeId) && !!turno,
  });
}

export function useCreateCalibrationEntry() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CalibrationEntryInsert) => {
      const { data: result, error } = await supabase
        .from("calibration_entries")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calibration-entries"] });
      queryClient.invalidateQueries({ queryKey: ["calibration-approved-today"] });
      toast({
        title: "Calibración guardada",
        description: "La entrada de calibración se guardó exitosamente",
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

export function useUpdateCalibrationEntry() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: CalibrationEntryUpdate }) => {
      const { data, error } = await supabase
        .from("calibration_entries")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calibration-entries"] });
      queryClient.invalidateQueries({ queryKey: ["calibration-approved-today"] });
      toast({
        title: "Calibración actualizada",
        description: "La entrada se actualizó exitosamente",
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

export function useApproveCalibrationEntry() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("calibration_entries")
        .update({ approved: true })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calibration-entries"] });
      queryClient.invalidateQueries({ queryKey: ["calibration-approved-today"] });
      toast({
        title: "Calibración aprobada",
        description: "Esta calibración se marcó como aprobada del día",
      });
    },
    onError: (error) => {
      toast({
        title: "Error al aprobar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
