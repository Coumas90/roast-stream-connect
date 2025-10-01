import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCreateCalibrationEntry, useApproveCalibrationEntry } from "./useCalibrationEntries";
import { useToast } from "@/hooks/use-toast";

interface ApprovalParams {
  entryData: any;
  existingApprovedId?: string;
  onSuccess?: () => void;
}

export function useCalibrationApproval() {
  const [isApproving, setIsApproving] = useState(false);
  const [approvalStep, setApprovalStep] = useState<string>("");
  const createEntry = useCreateCalibrationEntry();
  const approveEntry = useApproveCalibrationEntry();
  const { toast } = useToast();

  const handleApproval = useCallback(async ({ entryData, existingApprovedId, onSuccess }: ApprovalParams) => {
    setIsApproving(true);
    
    try {
      // Step 1: Create new entry as NOT approved
      setApprovalStep("Creando nueva calibración...");
      console.debug("[Calibration] Creating new entry:", entryData);
      
      const result = await createEntry.mutateAsync({
        ...entryData,
        approved: false,
      });

      // Step 2: De-approve the old entry if it exists
      if (existingApprovedId) {
        setApprovalStep("Desaprobando calibración anterior...");
        console.debug("[Calibration] De-approving existing entry:", existingApprovedId);
        
        const { error: unapproveError } = await supabase
          .from("calibration_entries")
          .update({ approved: false, approved_at: null, approved_by: null })
          .eq("id", existingApprovedId);
        
        if (unapproveError) {
          console.error("[Calibration] Error de-approving:", unapproveError);
          throw unapproveError;
        }
      }

      // Step 3: Approve the new entry
      setApprovalStep("Aprobando nueva calibración...");
      console.debug("[Calibration] Approving new entry:", result.id);
      
      await approveEntry.mutateAsync(result.id);

      console.debug("[Calibration] Approval completed successfully");
      
      toast({
        title: "Calibración aprobada",
        description: "La calibración ha sido guardada y aprobada correctamente.",
      });

      onSuccess?.();
    } catch (error: any) {
      console.error("[Calibration] Approval error:", error);
      
      // Specific error handling
      if (error.message?.includes("Ya existe una calibración")) {
        toast({
          title: "Conflicto de Calibración",
          description: "Ya existe una calibración aprobada para este turno. Por favor, intenta nuevamente.",
          variant: "destructive",
        });
      } else if (error.code === "PGRST116" || error.message?.includes("permission")) {
        toast({
          title: "Error de Permisos",
          description: "No tienes permisos para aprobar esta calibración.",
          variant: "destructive",
        });
      } else if (error.code === "23505") {
        toast({
          title: "Error de Duplicación",
          description: "Esta calibración ya existe. Intenta con diferentes parámetros.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error al aprobar",
          description: error.message || "No se pudo aprobar la calibración. Por favor, intenta nuevamente.",
          variant: "destructive",
        });
      }
      
      throw error;
    } finally {
      setIsApproving(false);
      setApprovalStep("");
    }
  }, [createEntry, approveEntry, toast]);

  return {
    handleApproval,
    isApproving,
    approvalStep,
  };
}
