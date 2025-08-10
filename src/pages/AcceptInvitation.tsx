import React, { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export default function AcceptInvitation() {
  const [params] = useSearchParams();
  const { token: paramToken } = useParams();
  const token = useMemo(() => (paramToken ?? params.get("token") ?? ""), [paramToken, params]);
  const { isAuthenticated, signInClient } = useAuth();
  const [isAccepting, setIsAccepting] = useState(false);
  const navigate = useNavigate();
  const triedRef = useRef(false);

  useEffect(() => {
    // Auto-aceptar al volver autenticado con token
    if (!triedRef.current && token && isAuthenticated && !isAccepting) {
      triedRef.current = true;
      onAccept();
    }
  }, [isAuthenticated, token, isAccepting]);

  const onAccept = async () => {
    if (!token) {
      toast({ title: "Token inválido", description: "Falta token de invitación", variant: "destructive" });
      return;
    }
    if (!isAuthenticated) {
      toast({ title: "Inicia sesión", description: "Debes iniciar sesión para aceptar la invitación" });
      const next = window.location.pathname + window.location.search;
      await signInClient(next);
      return;
    }
    setIsAccepting(true);
    const { error } = await supabase.rpc("accept_invitation", { _token: token } as any);
    setIsAccepting(false);
    if (error) {
      console.log("[AcceptInvitation] error:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Invitación aceptada" });
      // Role-based redirect: if user is tupa_admin -> /admin, else /app
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (userId) {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
        const hasAdmin = (roles ?? []).some((r: any) => r.role === "tupa_admin");
        navigate(hasAdmin ? "/admin" : "/app", { replace: true });
      } else {
        navigate("/app", { replace: true });
      }
    }
  };

  return (
    <article>
      <Helmet>
        <title>Aceptar invitación | TUPÁ Hub</title>
        <meta name="description" content="Aceptar invitación a tenant/sucursal" />
      </Helmet>
      <Card>
        <CardHeader><CardTitle>Aceptar invitación</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {token ? (
            <>
              <div>Confirma para aceptar la invitación asociada a tu cuenta.</div>
              <Button onClick={onAccept} disabled={isAccepting}>{isAccepting ? "Aceptando..." : "Aceptar invitación"}</Button>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">No se encontró un token de invitación válido.</div>
          )}
        </CardContent>
      </Card>
    </article>
  );
}
