
import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateToken, sha256Hex } from "@/lib/crypto";
import { Copy, RefreshCw } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  tenantSlug: string | null;
};

export default function InviteOwnerDialog({ open, onOpenChange, tenantId, tenantSlug }: Props) {
  const [email, setEmail] = React.useState("");
  const [link, setLink] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isRevoking, setIsRevoking] = React.useState(false);

  const createInvitation = async () => {
    if (!email) return;
    if (!tenantSlug) {
      toast({ title: "Falta slug", description: "Asigna un slug al tenant antes de invitar", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const token = generateToken();
      const token_hash = await sha256Hex(token);
      const expires_at = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

      const { error } = await supabase.from("invitations").insert({
        tenant_id: tenantId,
        email,
        role: "owner",
        token_hash,
        expires_at,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      } as any);

      if (error) {
        console.log("[InviteOwnerDialog] insert invitation error:", error);
        toast({ title: "Error", description: "No se pudo crear la invitación", variant: "destructive" });
        return;
      }
      const url = `${window.location.origin}/invite/${encodeURIComponent(token)}`;
      setLink(url);
      toast({ title: "Invitación creada", description: "Copia y comparte el enlace con el usuario" });
      try {
        const { error: mailError } = await supabase.functions.invoke("send-invite", {
          body: { to: email, inviteUrl: url, tenantName: tenantSlug ?? undefined },
        });
        if (mailError) {
          console.log("[InviteOwnerDialog] send mail error:", mailError);
          toast({ title: "No se pudo enviar el email", description: "Comparte el enlace manualmente", variant: "destructive" });
        } else {
          toast({ title: "Email enviado", description: `Se envió a ${email}` });
        }
      } catch (e: any) {
        console.log("[InviteOwnerDialog] invoke error:", e);
        toast({ title: "No se pudo enviar el email", description: "Comparte el enlace manualmente", variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const revokeInvitations = async () => {
    if (!email) {
      toast({ title: "Falta email", description: "Ingresa el email para revocar invitaciones pendientes", variant: "destructive" });
      return;
    }
    setIsRevoking(true);
    const { error } = await supabase
      .from("invitations")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("email", email.toLowerCase())
      .is("accepted_at", null);
    setIsRevoking(false);
    if (error) {
      console.log("[InviteOwnerDialog] revoke error:", error);
      toast({ title: "Error", description: "No se pudo revocar la invitación", variant: "destructive" });
    } else {
      toast({ title: "Invitación revocada" });
      setLink(null);
    }
  };

  const onCopy = async () => {
    if (link) {
      await navigator.clipboard.writeText(link);
      toast({ title: "Enlace copiado" });
    }
  };

  const onRegenerate = () => {
    setLink(null);
    // Admin can create a new invitation after revoking or once the previous is accepted/expired.
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invitar Owner</DialogTitle>
          <DialogDescription>Creará una invitación para el rol Owner en este tenant.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input placeholder="owner@cliente.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {link && (
            <div className="space-y-1">
              <Label>Enlace de invitación</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={link} />
                <Button variant="outline" onClick={onCopy}><Copy className="h-4 w-4" /></Button>
                <Button variant="ghost" onClick={onRegenerate}><RefreshCw className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button variant="outline" onClick={revokeInvitations} disabled={isLoading || isRevoking || !email}>
            {isRevoking ? "Revocando..." : "Revocar invitación"}
          </Button>
          <Button onClick={createInvitation} disabled={isLoading || !email}>
            {isLoading ? "Creando..." : "Crear invitación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
