import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRecipeDependencies } from "@/hooks/useRecipeDependencies";
import { AlertTriangle, Loader2 } from "lucide-react";

interface DeleteRecipeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  recipeId: string;
  recipeName: string;
  action: "delete" | "archive";
}

export function DeleteRecipeModal({
  open,
  onOpenChange,
  onConfirm,
  recipeId,
  recipeName,
  action,
}: DeleteRecipeModalProps) {
  const { data: dependencies, isLoading } = useRecipeDependencies(recipeId);

  const actionLabel = action === "delete" ? "eliminar" : "archivar";
  const actionLabelCaps = action === "delete" ? "Eliminar" : "Archivar";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {actionLabelCaps} receta "{recipeName}"
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            {isLoading ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Verificando dependencias...</span>
              </div>
            ) : dependencies?.canDelete ? (
              <p>
                ¿Estás seguro que querés {actionLabel} esta receta? Esta acción no se puede deshacer.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="font-medium text-destructive">
                  ⚠️ Esta receta no puede ser eliminada porque está en uso:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {dependencies?.hasCalibrations && (
                    <li>
                      {dependencies.calibrationCount} calibración
                      {dependencies.calibrationCount !== 1 ? "es" : ""} registrada
                      {dependencies.calibrationCount !== 1 ? "s" : ""}
                    </li>
                  )}
                  {dependencies?.hasProfiles && (
                    <li>
                      {dependencies.profileCount} perfil
                      {dependencies.profileCount !== 1 ? "es" : ""} de café configurado
                      {dependencies.profileCount !== 1 ? "s" : ""}
                    </li>
                  )}
                </ul>
                {action === "delete" && (
                  <p className="text-sm">
                    💡 Podés archivarla en su lugar para mantener el historial.
                  </p>
                )}
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading || !dependencies?.canDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {actionLabelCaps}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
