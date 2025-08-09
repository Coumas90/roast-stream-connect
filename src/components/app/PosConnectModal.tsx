import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AppPosProvider } from "@/integrations/supabase/pos-types";
import { usePosActions } from "@/hooks/usePosProvider";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultProvider?: AppPosProvider;
};

const providerLabels: Record<AppPosProvider, string> = {
  fudo: "Fudo",
  maxirest: "Maxirest",
  bistrosoft: "Bistrosoft",
  other: "ERP/Otro",
};

const helpLinks: Record<AppPosProvider, string> = {
  fudo: "https://help.fu.do/es/articles/6310417-api",
  maxirest: "https://maxirest.com.ar/",
  bistrosoft: "https://bistrosoft.com/",
  other: "https://odoo.com/", // Placeholder genérico
};

export default function PosConnectModal({ open, onOpenChange, defaultProvider }: Props) {
  const [provider, setProvider] = useState<AppPosProvider | undefined>(defaultProvider);
  const [apiKey, setApiKey] = useState("");
  const [errors, setErrors] = useState<{ provider?: string; apiKey?: string }>({});
  const [saving, setSaving] = useState(false);
  const { connect } = usePosActions();

  useEffect(() => {
    if (open) {
      setErrors({});
      setApiKey("");
      setProvider(defaultProvider);
    }
  }, [open, defaultProvider]);

  const isValid = useMemo(() => !!provider, [provider]);

  const onSubmit = async () => {
    const nextErrors: typeof errors = {};
    if (!provider) nextErrors.provider = "Selecciona un proveedor";
    // La API key es opcional: si la ingresás, validamos y guardamos credenciales
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await connect(provider!, apiKey.trim());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conectar POS</DialogTitle>
          <DialogDescription>Vinculá tu sucursal a tu proveedor de POS.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Proveedor</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as AppPosProvider)}>
              <SelectTrigger aria-invalid={!!errors.provider}>
                <SelectValue placeholder="Seleccionar proveedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fudo">Fudo</SelectItem>
                <SelectItem value="maxirest">Maxirest</SelectItem>
                <SelectItem value="bistrosoft">Bistrosoft</SelectItem>
                <SelectItem value="other">ERP/Otro</SelectItem>
              </SelectContent>
            </Select>
            {errors.provider ? (
              <p className="text-sm text-destructive mt-1">{errors.provider}</p>
            ) : null}
            {provider ? (
              <a
                className="text-sm underline mt-1 inline-block"
                href={helpLinks[provider]}
                target="_blank"
                rel="noreferrer"
              >
                ¿Cómo obtengo mi API key para {providerLabels[provider]}?
              </a>
            ) : null}
          </div>

          <div>
            <Label>API Key</Label>
            <Input
              placeholder="Opcional: ingresa tu API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              aria-invalid={!!errors.apiKey}
            />
            {errors.apiKey ? (
              <p className="text-sm text-destructive mt-1">{errors.apiKey}</p>
            ) : null}
            <p className="text-xs text-muted-foreground mt-1">Si el nuevo proveedor requiere credenciales, te las pediremos.</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={onSubmit} aria-busy={saving} disabled={saving || !isValid}>
              {saving ? "Conectando…" : "Conectar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
