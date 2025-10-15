import React, { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Mail, UserCheck, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InvitationDetails {
  email: string;
  role: string;
  tenant_id: string;
  tenant_name: string;
  location_id: string | null;
  location_name: string | null;
  expires_at: string;
  inviter_name: string | null;
  inviter_email: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Propietario",
  manager: "Gerente",
  coffee_master: "Coffee Master",
  barista: "Barista",
};

export default function AcceptInvitation() {
  const [params] = useSearchParams();
  const { token: paramToken } = useParams();
  const token = useMemo(() => (paramToken ?? params.get("token") ?? ""), [paramToken, params]);
  const { isAuthenticated, signInClient } = useAuth();
  const [isAccepting, setIsAccepting] = useState(false);
  const [invitationDetails, setInvitationDetails] = useState<InvitationDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const navigate = useNavigate();
  const triedRef = useRef(false);

  // Fetch invitation details on mount
  useEffect(() => {
    if (!token) {
      setIsLoadingDetails(false);
      setDetailsError("Token de invitación no encontrado");
      return;
    }

    const fetchDetails = async () => {
      try {
        const { data, error } = await supabase.rpc("get_invitation_details", { _token: token });
        if (error) throw error;
        if (!data || data.length === 0) {
          setDetailsError("Invitación inválida o expirada");
        } else {
          setInvitationDetails(data[0]);
        }
      } catch (err: any) {
        console.error("[AcceptInvitation] Error fetching details:", err);
        setDetailsError(err.message || "Error al cargar los detalles de la invitación");
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchDetails();
  }, [token]);

  useEffect(() => {
    // Auto-aceptar al volver autenticado con token
    if (!triedRef.current && token && isAuthenticated && !isAccepting) {
      triedRef.current = true;
      onAccept();
    }
  }, [isAuthenticated, token, isAccepting]);

  const onAccept = async () => {
    if (!token) {
      toast({ title: "Error", description: "Token de invitación no encontrado", variant: "destructive" });
      return;
    }
    if (!isAuthenticated) {
      toast({ 
        title: "Inicia sesión primero", 
        description: "Debes iniciar sesión con Google para aceptar la invitación" 
      });
      const next = window.location.pathname + window.location.search;
      await signInClient(next);
      return;
    }
    setIsAccepting(true);
    try {
      const { error } = await supabase.rpc("accept_invitation", { _token: token } as any);
      if (error) throw error;

      toast({ 
        title: "¡Bienvenido/a! 🎉", 
        description: `Te has unido exitosamente a ${invitationDetails?.tenant_name || "el equipo"}`,
        duration: 5000
      });

      // Role-based redirect
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (userId) {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
        const hasAdmin = (roles ?? []).some((r: any) => r.role === "tupa_admin");
        navigate(hasAdmin ? "/admin" : "/app", { replace: true });
      } else {
        navigate("/app", { replace: true });
      }
    } catch (err: any) {
      console.error("[AcceptInvitation] error:", err);
      toast({ 
        title: "Error al aceptar", 
        description: err.message || "No se pudo procesar la invitación. Por favor, intenta nuevamente.", 
        variant: "destructive" 
      });
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-accent/5">
      <Helmet>
        <title>Aceptar invitación | TUPÁ Hub</title>
        <meta name="description" content="Únete al equipo en TUPÁ Hub" />
      </Helmet>

      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="space-y-3 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Invitación al equipo</CardTitle>
              <CardDescription>Revisa los detalles antes de aceptar</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isLoadingDetails ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Cargando detalles de la invitación...</p>
            </div>
          ) : detailsError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{detailsError}</AlertDescription>
            </Alert>
          ) : invitationDetails ? (
            <>
              {/* Invitation Details */}
              <div className="space-y-4 p-5 rounded-lg border bg-card">
                <div className="flex items-start gap-3">
                  <UserCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">Rol asignado</p>
                    <Badge variant="secondary" className="text-sm">
                      {ROLE_LABELS[invitationDetails.role] || invitationDetails.role}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">Organización</p>
                    <p className="text-base">{invitationDetails.tenant_name}</p>
                    {invitationDetails.location_name && (
                      <p className="text-sm text-muted-foreground">
                        Sucursal: {invitationDetails.location_name}
                      </p>
                    )}
                  </div>
                </div>

                {invitationDetails.inviter_name && (
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">Invitado por</p>
                      <p className="text-base">{invitationDetails.inviter_name}</p>
                      {invitationDetails.inviter_email && (
                        <p className="text-sm text-muted-foreground">{invitationDetails.inviter_email}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">Válida hasta</p>
                    <p className="text-base">
                      {new Date(invitationDetails.expires_at).toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Benefits Section */}
              <div className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Al aceptar tendrás acceso a:
                </p>
                <ul className="space-y-2 ml-6 text-sm text-muted-foreground">
                  <li>• Sistema de calibración de café profesional</li>
                  <li>• Gestión de inventario en tiempo real</li>
                  <li>• Herramientas de formación y capacitación</li>
                  <li>• Panel de métricas y analytics</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button 
                  onClick={onAccept} 
                  disabled={isAccepting}
                  className="flex-1 h-11"
                  size="lg"
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Aceptar invitación
                    </>
                  )}
                </Button>
              </div>

              {!isAuthenticated && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Necesitas iniciar sesión con Google para aceptar esta invitación.
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No se encontró un token de invitación válido.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
