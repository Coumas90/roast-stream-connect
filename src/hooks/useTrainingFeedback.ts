import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface TrainingFeedback {
  id: string;
  training_request_id: string;
  participant_id: string;
  instructor_id?: string;
  overall_rating?: number;
  content_rating?: number;
  instructor_rating?: number;
  venue_rating?: number;
  what_learned?: string;
  suggestions?: string;
  additional_comments?: string;
  submitted_at: string;
  completion_time_minutes?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTrainingFeedback {
  training_request_id: string;
  overall_rating: number;
  content_rating: number;
  instructor_rating: number;
  venue_rating: number;
  what_learned?: string;
  suggestions?: string;
  additional_comments?: string;
  completion_time_minutes?: number;
}

// Hook to fetch feedback for a specific training request
export function useTrainingFeedback(trainingRequestId?: string) {
  return useQuery({
    queryKey: ["training-feedback", trainingRequestId],
    queryFn: async () => {
      if (!trainingRequestId) return null;
      
      const { data, error } = await supabase
        .from("training_feedback")
        .select("*")
        .eq("training_request_id", trainingRequestId)
        .maybeSingle();

      if (error) throw error;
      return data as TrainingFeedback | null;
    },
    enabled: !!trainingRequestId,
  });
}

// Hook to fetch all feedback (admin only)
export function useAllTrainingFeedback() {
  return useQuery({
    queryKey: ["training-feedback-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_feedback")
        .select(`
          *,
          training_requests!inner(
            id,
            training_type,
            location_id,
            locations(name)
          )
        `)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      return data as TrainingFeedback[];
    },
  });
}

// Hook to create feedback
export function useCreateTrainingFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (feedback: CreateTrainingFeedback) => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("training_feedback")
        .insert({
          ...feedback,
          participant_id: user.data.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-feedback"] });
      toast({
        title: "Feedback enviado",
        description: "Gracias por completar la encuesta de feedback.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo enviar el feedback. Intenta nuevamente.",
        variant: "destructive",
      });
      console.error("Error creating training feedback:", error);
    },
  });
}

// Hook to check if feedback exists for a training request
export function useHasFeedback(trainingRequestId?: string) {
  return useQuery({
    queryKey: ["has-feedback", trainingRequestId],
    queryFn: async () => {
      if (!trainingRequestId) return false;
      
      const { data, error } = await supabase
        .from("training_feedback")
        .select("id")
        .eq("training_request_id", trainingRequestId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!trainingRequestId,
  });
}

// Hook to get feedback analytics (admin only)
export function useFeedbackAnalytics() {
  return useQuery({
    queryKey: ["feedback-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_feedback")
        .select(`
          overall_rating,
          content_rating,
          instructor_rating,
          venue_rating,
          training_requests!inner(
            training_type,
            location_id,
            instructor_id
          )
        `);

      if (error) throw error;

      // Calculate averages
      const totalFeedback = data.length;
      const averages = {
        overall: data.reduce((sum, f) => sum + (f.overall_rating || 0), 0) / totalFeedback,
        content: data.reduce((sum, f) => sum + (f.content_rating || 0), 0) / totalFeedback,
        instructor: data.reduce((sum, f) => sum + (f.instructor_rating || 0), 0) / totalFeedback,
        venue: data.reduce((sum, f) => sum + (f.venue_rating || 0), 0) / totalFeedback,
      };

      // Group by training type
      const byTrainingType = data.reduce((acc, feedback) => {
        const type = (feedback as any).training_requests?.training_type || 'Unknown';
        if (!acc[type]) {
          acc[type] = { count: 0, totalRating: 0 };
        }
        acc[type].count++;
        acc[type].totalRating += feedback.overall_rating || 0;
        return acc;
      }, {} as Record<string, { count: number; totalRating: number }>);

      return {
        totalFeedback,
        averages,
        byTrainingType,
      };
    },
  });
}