import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type TrainingStatus = 'pending' | 'approved' | 'scheduled' | 'completed' | 'cancelled';
export type TrainingType = 'barista_basics' | 'latte_art' | 'coffee_cupping' | 'equipment_maintenance' | 'custom';
export type TrainingPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TrainingRequest {
  id: string;
  tenant_id: string;
  location_id: string;
  requested_by: string;
  status: TrainingStatus;
  training_type: TrainingType;
  priority: TrainingPriority;
  estimated_duration_hours: number;
  estimated_days: number;
  preferred_date?: string;
  specific_topics: string[];
  notes?: string;
  created_at: string;
  scheduled_at?: string;
  completed_at?: string;
  locations?: {
    name: string;
    code?: string;
  };
}

export interface CreateTrainingRequest {
  location_id: string;
  training_type?: TrainingType;
  priority?: TrainingPriority;
  estimated_duration_hours?: number;
  estimated_days?: number;
  preferred_date?: string;
  specific_topics?: string[];
  notes?: string;
}

export function useTrainingRequests(locationId?: string) {
  return useQuery({
    queryKey: ["training-requests", locationId],
    queryFn: async () => {
      let query = supabase
        .from("training_requests")
        .select(`
          *,
          locations(name, code)
        `)
        .order("created_at", { ascending: false });

      if (locationId) {
        query = query.eq("location_id", locationId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as TrainingRequest[];
    },
    // Always enable for admins (no locationId) and when locationId is provided
    enabled: true,
  });
}

export function useCreateTrainingRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateTrainingRequest) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      // Get tenant_id from location
      const { data: location } = await supabase
        .from("locations")
        .select("tenant_id")
        .eq("id", request.location_id)
        .single();

      if (!location) throw new Error("Location not found");

      const { data, error } = await supabase
        .from("training_requests")
        .insert({
          tenant_id: location.tenant_id,
          location_id: request.location_id,
          requested_by: user.id,
          training_type: request.training_type || 'barista_basics',
          priority: request.priority || 'medium',
          estimated_duration_hours: request.estimated_duration_hours || 4,
          estimated_days: request.estimated_days || 1,
          preferred_date: request.preferred_date,
          specific_topics: request.specific_topics || [],
          notes: request.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-requests"] });
      toast({
        title: "Solicitud enviada",
        description: "Tu solicitud de capacitación ha sido enviada exitosamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo enviar la solicitud de capacitación.",
        variant: "destructive",
      });
      console.error("Error creating training request:", error);
    },
  });
}

export function useTrainingEnabled(locationId?: string) {
  return useQuery({
    queryKey: ["training-enabled", locationId],
    queryFn: async () => {
      if (!locationId) return false;

      const { data, error } = await supabase
        .from("entitlements")
        .select("training_enabled")
        .eq("location_id", locationId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching training entitlement:", error);
        return false;
      }

      return data?.training_enabled || false;
    },
    enabled: !!locationId,
  });
}