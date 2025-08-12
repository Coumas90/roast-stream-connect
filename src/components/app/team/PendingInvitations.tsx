import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useInvitations, useResendInvitation, useRevokeInvitation } from "@/hooks/useTeam";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Mail, RotateCcw, Trash2, Clock, Copy, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

const ROLE_LABELS = {
  manager: 'Encargado',
  coffee_master: 'Coffee Master', 
  barista: 'Barista',
} as const;

interface PendingInvitationsProps {
  onInviteClick?: () => void;
  canInvite?: boolean;
}
export function PendingInvitations({ onInviteClick, canInvite = false }: PendingInvitationsProps) {
  const { data: invitations, isLoading, error } = useInvitations();
  const resendInvitation = useResendInvitation();
  const revokeInvitation = useRevokeInvitation();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Invitaciones pendientes
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 p-4 lg:p-8 pt-4 lg:pt-8">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-16" />
              <div className="flex gap-1">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Invitaciones pendientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            Error al cargar las invitaciones
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!invitations?.length) {
    return (
      <Card className="shadow-elegant transition-all hover:shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Invitaciones pendientes
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 lg:px-8 py-10 text-center pt-10">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 lg:h-16 lg:w-16 rounded-full bg-warning grid place-items-center">
              <Clock className="w-6 h-6 lg:w-8 lg:h-8 text-warning-foreground" />
            </div>
            <p className="text-muted-foreground max-w-sm">
              No hay invitaciones enviadas. Envía una para que tu equipo se una.
            </p>
            <Button
              onClick={onInviteClick}
              disabled={!canInvite}
              title={!canInvite ? 'No tienes permisos para invitar' : undefined}
              variant="pill"
              className="bg-warning text-warning-foreground hover:bg-warning/90 hover-scale rounded-full w-full md:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Invitar ahora
            </Button>
            {!canInvite && (
              <p className="text-sm text-muted-foreground">
                No tienes permisos para invitar miembros. Contacta a un administrador.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleResend = (invitationId: string) => {
    resendInvitation.mutate(invitationId);
  };

  const handleRevoke = (invitationId: string) => {
    revokeInvitation.mutate(invitationId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Invitaciones pendientes
          <Badge variant="secondary" className="ml-2 rounded-full">{invitations.length}</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Invitaciones enviadas aún no aceptadas
        </p>
      </CardHeader>
      <CardContent className="p-4 lg:p-8 pt-4 lg:pt-8">
        <div className={`grid gap-3 md:grid-cols-2 ${invitations.length > 6 ? 'max-h-[28rem] overflow-auto pr-1' : ''}`}>
          {invitations.map((invitation) => (
            <article
              key={invitation.id}
              className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-elegant transition-all md:hover:shadow-xl md:hover:-translate-y-0.5"
            >
              <div className="h-12 w-12 rounded-full bg-muted grid place-items-center">
                <Mail className="w-6 h-6 text-muted-foreground" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-medium truncate lg:whitespace-normal lg:overflow-visible lg:break-words">
                  {invitation.email} — {ROLE_LABELS[invitation.role as keyof typeof ROLE_LABELS] || invitation.role}
                </p>
                <div className="mt-1">
                  <Badge variant="secondary" className="rounded-full">
                    Expira {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true, locale: es })}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      const { data } = await resendInvitation.mutateAsync(invitation.id);
                      const newToken = data?.[0]?.token || (invitation as any).token;
                      const link = newToken ? `${window.location.origin}/invite/${newToken}` : '';
                      if (link) {
                        await navigator.clipboard.writeText(link);
                        toast.success('Link de invitación copiado');
                      }
                    } catch (e) {
                      // handled by hook toast
                    }
                  }}
                  disabled={resendInvitation.isPending}
                  title="Copiar link"
                  className="hover:bg-accent hover-scale"
                >
                  <Copy className="w-4 h-4" />
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleResend(invitation.id)}
                  disabled={resendInvitation.isPending}
                  title="Reenviar invitación"
                  className="hover:bg-accent hover-scale"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={revokeInvitation.isPending}
                      title="Revocar invitación"
                      className="hover:bg-accent hover-scale"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Revocar invitación?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. La invitación para {invitation.email} será revocada permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleRevoke(invitation.id)}>
                        Revocar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-4 text-center">
          <Button
            onClick={onInviteClick}
            disabled={!canInvite}
            title={!canInvite ? 'No tienes permisos para invitar' : undefined}
            variant="pill"
            className="bg-warning text-warning-foreground hover:bg-warning/90 hover-scale rounded-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Invitar miembro
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}