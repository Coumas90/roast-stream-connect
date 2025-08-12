import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import UserAvatar from "@/components/ui/UserAvatar";
import { TeamMember } from "@/hooks/useTeam";

interface MemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
}

export default function MemberDialog({ open, onOpenChange, member }: MemberDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Detalle del miembro</DialogTitle>
          <DialogDescription>Información del colaborador seleccionado.</DialogDescription>
        </DialogHeader>

        {member ? (
          <div className="flex items-start gap-4">
            <UserAvatar fullName={member.full_name} email={member.email} className="h-12 w-12" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold truncate">{member.full_name || member.email || 'Usuario sin nombre'}</h3>
                <Badge variant="secondary" className="rounded-full">{member.role}</Badge>
              </div>
              {member.email ? (
                <p className="text-muted-foreground text-sm truncate">{member.email}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">No hay miembro seleccionado.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
