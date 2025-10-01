import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ConsumptionAugmentedDatabase } from "@/integrations/supabase/types.augment";

type CalibrationEntry = ConsumptionAugmentedDatabase["public"]["Tables"]["calibration_entries"]["Row"];
type CalibrationEntryInsert = ConsumptionAugmentedDatabase["public"]["Tables"]["calibration_entries"]["Insert"];
type CalibrationEntryUpdate = ConsumptionAugmentedDatabase["public"]["Tables"]["calibration_entries"]["Update"];

export function useCalibrationEntries(coffeeProfileId?: string, fecha?: string) {
  return useQuery({
    queryKey: ["calibration-entries", coffeeProfileId, fecha],
    queryFn: async () => {
      let query = supabase
        .from("calibration_entries")
        .select("*")
        .order("created_at", { ascending: false });

      if (coffeeProfileId) {
        query = query.eq("coffee_profile_id", coffeeProfileId);
      }

      if (fecha) {
        query = query.eq("fecha", fecha);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as CalibrationEntry[];
    },
    enabled: !!coffeeProfileId,
  });
}

export function useTodayApprovedEntry(coffeeProfileId?: string, turno?: string) {
  const today = new Date().toISOString().split('T')[0];
  
  return useQuery({
    queryKey: ["calibration-approved-today", coffeeProfileId, turno, today],
    queryFn: async () => {
      if (!coffeeProfileId || !turno) return null;

      const { data, error } = await supabase
        .from("calibration_entries")
        .select("*")
        .eq("coffee_profile_id", coffeeProfileId)
        .eq("fecha", today)
        .eq("turno", turno)
        .eq("approved", true)
        .maybeSingle();

      if (error) throw error;
      return data as CalibrationEntry | null;
    },
    enabled: !!coffeeProfileId && !!turno,
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
