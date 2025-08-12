import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Invitation, useResendInvitation, useRevokeInvitation } from "@/hooks/useTeam";
import { Copy, RotateCcw, Trash2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface InvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invitation: Invitation | null;
}

export default function InvitationDialog({ open, onOpenChange, invitation }: InvitationDialogProps) {
  const resendInvitation = useResendInvitation();
  const revokeInvitation = useRevokeInvitation();

  const handleCopyLink = async () => {
    if (!invitation) return;
    try {
      // El token actualizado se obtiene al reenviar; aquí usamos el actual si estuviera disponible
      const token = (invitation as any).token;
      const link = token ? `${window.location.origin}/invite/${token}` : '';
      if (link) {
        await navigator.clipboard.writeText(link);
        toast.success('Link de invitación copiado');
      } else {
        toast.info('Reenvía para generar un nuevo link');
      }
    } catch {}
  };

  const handleResend = async () => {
    if (!invitation) return;
    try {
      const { data } = await resendInvitation.mutateAsync(invitation.id);
      const newToken = data?.[0]?.token || (invitation as any).token;
      const link = newToken ? `${window.location.origin}/invite/${newToken}` : '';
      if (link) {
        await navigator.clipboard.writeText(link);
        toast.success('Link actualizado copiado');
      }
    } catch {}
  };

  const handleRevoke = async () => {
    if (!invitation) return;
    revokeInvitation.mutate(invitation.id, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Invitación</DialogTitle>
          <DialogDescription>Gestiona esta invitación pendiente.</DialogDescription>
        </DialogHeader>

        {invitation ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{invitation.email}</h3>
                <p className="text-muted-foreground text-sm truncate">Rol: {invitation.role}</p>
              </div>
              <Badge variant="secondary" className="rounded-full">Pendiente</Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="w-4 h-4" />
              Expira {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true, locale: es })}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" variant="ghost" onClick={handleCopyLink} title="Copiar link" className="hover:bg-accent hover-scale">
                <Copy className="w-4 h-4 mr-2" /> Copiar link
              </Button>
              <Button size="sm" variant="secondary" onClick={handleResend} disabled={resendInvitation.isPending} className="hover-scale">
                <RotateCcw className="w-4 h-4 mr-2" /> Reenviar
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" disabled={revokeInvitation.isPending} className="hover-scale">
                    <Trash2 className="w-4 h-4 mr-2" /> Revocar
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
                    <AlertDialogAction onClick={handleRevoke}>Revocar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">No hay invitación seleccionada.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
