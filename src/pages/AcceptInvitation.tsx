
import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export default function AcceptInvitation() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") ?? "", [params]);
  const { isAuthenticated, signInClient } = useAuth();
  const [isAccepting, setIsAccepting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // no side effects on mount; user must click
  }, []);

  const onAccept = async () => {
    if (!token) {
      toast({ title: "Token inválido", description: "Falta token de invitación", variant: "destructive" });
      return;
    }
    if (!isAuthenticated) {
      toast({ title: "Inicia sesión", description: "Debes iniciar sesión para aceptar la invitación" });
      await signInClient();
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
      navigate("/app", { replace: true });
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
