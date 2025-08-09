import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UpdatePasswordPayload {
  password: string;
}

export function useUpdatePassword() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async ({ password }: UpdatePasswordPayload) => {
    setError(null);

    if (!password || password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setIsPending(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        toast({ title: "No se pudo actualizar", description: updateError.message, variant: "destructive" });
        return;
      }

      // Cerrar sesión por seguridad
      await supabase.auth.signOut();
      setIsSuccess(true);
      toast({ title: "Contraseña actualizada", description: "Ahora puedes iniciar sesión con tu nueva contraseña." });

      // Redirigir según contexto
      const params = new URLSearchParams(window.location.search);
      const ctx = params.get("ctx");
      const target = ctx === "admin" ? "/admin/login" : "/app/login"; // fallback seguro
      window.location.replace(target);
    } catch (e: any) {
      const msg = e?.message || "Error inesperado";
      setError(msg);
      toast({ title: "No se pudo actualizar", description: msg, variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  }, [toast]);

  return { mutate, isPending, isSuccess, error };
}
