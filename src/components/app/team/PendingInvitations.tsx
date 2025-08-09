import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useInvitations, useResendInvitation, useRevokeInvitation } from "@/hooks/useTeam";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Mail, RotateCcw, Trash2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const ROLE_LABELS = {
  manager: 'Encargado',
  coffee_master: 'Coffee Master', 
  barista: 'Barista',
} as const;

export function PendingInvitations() {
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
        <CardContent className="space-y-3">
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Invitaciones pendientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No hay invitaciones pendientes
          </p>
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
          Invitaciones pendientes ({invitations.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {invitations.map((invitation) => (
          <div key={invitation.id} className="flex items-center gap-3 p-3 border rounded-lg">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{invitation.email}</p>
              <p className="text-sm text-muted-foreground">
                Expira {formatDistanceToNow(new Date(invitation.expires_at), { 
                  addSuffix: true, 
                  locale: es 
                })}
              </p>
            </div>
            <Badge variant="outline">
              {ROLE_LABELS[invitation.role as keyof typeof ROLE_LABELS] || invitation.role}
            </Badge>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleResend(invitation.id)}
                disabled={resendInvitation.isPending}
                title="Reenviar invitación"
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
          </div>
        ))}
      </CardContent>
    </Card>
  );
}