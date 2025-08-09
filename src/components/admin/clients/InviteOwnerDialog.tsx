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
      const url = `${window.location.origin}/invite?token=${encodeURIComponent(token)}`;
      setLink(url);
      toast({ title: "Invitación creada", description: "Copia y comparte el enlace con el usuario" });
    } finally {
      setIsLoading(false);
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
    // Admin can create a new invitation. The unique index on open invitations may require deleting the previous one first.
    // Keep it simple: we just allow creating a new one after the previous is accepted or deleted externally.
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
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button onClick={createInvitation} disabled={isLoading || !email}>Crear invitación</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
