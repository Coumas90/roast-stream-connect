import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateInvitation, useUserRole } from "@/hooks/useTeam";
import { useTenant } from "@/lib/tenant";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLE_LABELS = {
  manager: 'Encargado',
  coffee_master: 'Coffee Master',
  barista: 'Barista',
} as const;

export function InviteDialog({ open, onOpenChange }: InviteDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<'manager' | 'coffee_master' | 'barista'>('barista');
  const [inviteResult, setInviteResult] = useState<{ token: string; email: string } | null>(null);
  
  const { location } = useTenant();
  const { data: userRole } = useUserRole();
  const createInvitation = useCreateInvitation();

  // Filter roles based on current user's role
  const availableRoles = React.useMemo(() => {
    if (userRole === 'owner') {
      return ['manager', 'coffee_master', 'barista'] as const;
    } else if (userRole === 'manager') {
      return ['coffee_master', 'barista'] as const;
    }
    return [] as const;
  }, [userRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await createInvitation.mutateAsync({ email, role });
      if (result?.[0]) {
        setInviteResult({
          token: result[0].token,
          email: email,
        });
        setEmail("");
      }
    } catch (error) {
      // Error handled in mutation
    }
  };

  const inviteLink = inviteResult ? `${window.location.origin}/invite/${inviteResult.token}` : "";

  const copyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      toast.success('Enlace copiado al portapapeles');
    }
  };

  const handleClose = () => {
    setInviteResult(null);
    setEmail("");
    setRole('barista');
    onOpenChange(false);
  };

  if (!userRole || availableRoles.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invitar al equipo - {location}</DialogTitle>
        </DialogHeader>

        {!inviteResult ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@email.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <Select value={role} onValueChange={(value: any) => setRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((roleKey) => (
                    <SelectItem key={roleKey} value={roleKey}>
                      {ROLE_LABELS[roleKey]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createInvitation.isPending}>
                {createInvitation.isPending ? 'Enviando...' : 'Enviar invitación'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                Invitación enviada a: <strong>{inviteResult.email}</strong>
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                También puedes compartir este enlace:
              </p>
              <div className="flex items-center gap-2 p-2 bg-background rounded border">
                <code className="flex-1 text-xs break-all">{inviteLink}</code>
                <Button size="sm" variant="ghost" onClick={copyLink}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={inviteLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleClose}>Cerrar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}