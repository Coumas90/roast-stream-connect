import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SUCCESS_MESSAGE = "Si el correo existe, te enviamos un enlace para restablecer tu contraseña.";

function isValidEmail(email: string) {
  return /^[\w.!#$%&'*+/=?^_`{|}~-]+@[\w-]+(?:\.[\w-]+)+$/.test(email);
}

export function useRequestPasswordReset() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (email: string) => {
    setError(null);
    if (!isValidEmail(email)) {
      setError("Ingresa un email válido");
      return;
    }

    // Throttle simple por email (60s)
    const key = `pw_reset_ts:${email.toLowerCase()}`;
    const now = Date.now();
    const last = Number(localStorage.getItem(key) || 0);
    const THROTTLE_MS = 60_000;

    setIsPending(true);
    try {
      // Construir redirectTo con ctx si existe
      const params = new URLSearchParams(window.location.search);
      const ctx = params.get("ctx") || "";
      const origin = window.location.origin;
      const redirectTo = `${origin}/auth/reset-password${ctx ? `?ctx=${ctx}` : ""}`;

      if (now - last < THROTTLE_MS) {
        // Evitamos spam: no llamamos de nuevo a Supabase, pero mostramos éxito genérico
        toast({ title: "Solicitud enviada", description: SUCCESS_MESSAGE });
        setIsSuccess(true);
        return;
      }

      const { error: sbError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      // Independiente del resultado, nunca revelamos existencia del email
      if (sbError) {
        // No mostramos detalles del error para no filtrar información
        // Aun así, consideramos la experiencia como "éxito" para el usuario
      }

      localStorage.setItem(key, String(now));
      setIsSuccess(true);
      toast({ title: "Solicitud enviada", description: SUCCESS_MESSAGE });
    } catch (_) {
      // Mantenemos mismo mensaje para no filtrar info
      setIsSuccess(true);
      toast({ title: "Solicitud enviada", description: SUCCESS_MESSAGE });
    } finally {
      setIsPending(false);
    }
  }, [toast]);

  return { mutate, isPending, isSuccess, error };
}
