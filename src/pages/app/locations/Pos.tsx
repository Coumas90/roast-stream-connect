import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import type { AppPosProvider } from "@/integrations/supabase/pos-types";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useTeam";

// Provider labels consistent with Settings page
const providerLabels: Record<AppPosProvider, string> = {
  fudo: "Fudo",
  maxirest: "Maxirest",
  bistrosoft: "Bistrosoft",
  other: "ERP/Otro",
};

// Status badge variant mapping
const statusToVariant = (status?: string) => {
  const s = (status ?? "").toLowerCase();
  return s === "connected" ? "success" : s === "pending" ? "warning" : s === "invalid" ? "destructive" : "outline";
};

// Types for RPC rows
type CredRow = {
  location_id: string;
  provider: AppPosProvider;
  masked_hints: Record<string, unknown>;
  status: string;
  last_verified_at: string | null;
  updated_at: string;
};

type FudoCreds = { apiKey: string; apiSecret: string; env?: "production" | "staging" };
type BistrosoftCreds = { apiKey: string };
type MaxirestCreds = { apiKey: string; token?: string };
type OtherCreds = Record<string, unknown>;

type AnyCreds = FudoCreds | BistrosoftCreds | MaxirestCreds | OtherCreds;

export default function LocationPosDetail() {
  const { id: locationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: effectiveRole } = useUserRole();

  // Guard: only owner/manager/platform admin
  if (effectiveRole && !["owner", "manager", "tupa_admin"].includes(effectiveRole)) {
    return <Navigate to="/app" replace />;
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CredRow[]>([]);

  // Form state
  const [provider, setProvider] = useState<AppPosProvider>("fudo");
  const [fudo, setFudo] = useState<FudoCreds>({ apiKey: "", apiSecret: "", env: "production" });
  const [bistrosoft, setBistrosoft] = useState<BistrosoftCreds>({ apiKey: "" });
  const [maxirest, setMaxirest] = useState<MaxirestCreds>({ apiKey: "", token: "" });
  const [otherJson, setOtherJson] = useState<string>("{\n  \"apiKey\": \"\"\n}");
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [testing, setTesting] = useState(false);
  const selectedRow = useMemo(() => rows.find((r) => r.provider === provider) || null, [rows, provider]);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      if (!locationId) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await (supabase.rpc as any)("pos_provider_credentials_public", { _location_id: locationId });
        if (error) throw error;
        if (cancelled) return;
        const rows = (data as CredRow[]) ?? [];
        setRows(rows);
        // Default provider to most recently updated if exists
        if (rows.length > 0) {
          const latest = [...rows].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
          setProvider(latest.provider);
          // Pre-fill env from hints if present (no secrets are prefilled)
          if (latest.provider === "fudo") {
            const hints = latest.masked_hints as any;
            setFudo((prev) => ({ ...prev, env: (hints?.env as any) === "staging" ? "staging" : "production" }));
          }
        }
      } catch (e: any) {
        setError(e?.message ?? "Error al cargar datos de POS");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const statusBadge = (status?: string) => {
    const s = (status ?? "").toLowerCase();
    const variant = statusToVariant(s);
    const label = s ? s : "sin datos";
    return <Badge variant={variant as any} className="capitalize">{label}</Badge>;
  };

  const allProviders: AppPosProvider[] = ["fudo", "bistrosoft", "maxirest", "other"];

  async function onSave() {
    if (!locationId) return;
    setSaving(true);
    try {
      let credentials: AnyCreds;
      if (provider === "fudo") {
        if (!fudo.apiKey?.trim() || !fudo.apiSecret?.trim()) throw new Error("Ingresá apiKey y apiSecret de Fudo");
        credentials = { apiKey: fudo.apiKey.trim(), apiSecret: fudo.apiSecret.trim(), ...(fudo.env ? { env: fudo.env } : {}) };
      } else if (provider === "bistrosoft") {
        if (!bistrosoft.apiKey?.trim()) throw new Error("Ingresá tu API key de Bistrosoft");
        credentials = { apiKey: bistrosoft.apiKey.trim() };
      } else if (provider === "maxirest") {
        if (!maxirest.apiKey?.trim()) throw new Error("Ingresá tu API key de Maxirest");
        credentials = { apiKey: maxirest.apiKey.trim(), ...(maxirest.token?.trim() ? { token: maxirest.token.trim() } : {}) };
      } else {
        // OTHER: parse JSON
        try {
          const parsed = JSON.parse(otherJson);
          if (!parsed || typeof parsed !== "object") throw new Error();
          if (!parsed.apiKey || typeof parsed.apiKey !== "string" || !parsed.apiKey.trim()) {
            throw new Error("El JSON debe incluir apiKey");
          }
          credentials = parsed as OtherCreds;
        } catch (e: any) {
          throw new Error(e?.message || "JSON inválido en Otros");
        }
      }

      const { data, error } = await supabase.functions.invoke("pos-save-credentials", {
        body: { locationId, provider, credentials },
      });

      if (error) {
        if ((error as any).status === 403) {
          toast.error("No tenés permiso para gestionar el POS de esta sucursal (403)");
        } else {
          toast.error("No se pudieron guardar las credenciales");
        }
        return;
      }

      const st = (data as any)?.status || "pending";
      toast.success(`Credenciales guardadas (estado: ${st}).`);
      // Refresh
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function onVerify() {
    if (!locationId) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("pos-verify-credentials", {
        body: { locationId, provider },
      });
      if (error) {
        if ((error as any).status === 403) {
          toast.error("No tenés permiso para verificar el POS de esta sucursal (403)");
        } else {
          toast.error("No se pudo verificar la conexión");
        }
        return;
      }
      const st = (data as any)?.status as string | undefined;
      if (st === "connected") toast.success("Conexión exitosa (connected).");
      else if (st === "invalid") toast.error("Credenciales inválidas (invalid).");
      else toast("Verificación realizada.");
      await refresh();
    } finally {
      setVerifying(false);
    }
  }

  async function onTestSync() {
    if (!locationId) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("pos-sync-ui", {
        body: { locationId, provider },
      });
      if (error) {
        if ((error as any).status === 403) {
          toast.error("No tenés permiso para ejecutar el sync de esta sucursal (403)");
        } else {
          toast.error("No se pudo ejecutar el sync");
        }
        return;
      }
      const res = data as any;
      if (res?.runId && typeof res?.count === "number") {
        toast.success(`OK: ${res.count} ventas agregadas (dry-run).`);
      } else if (res?.skipped) {
        const reason = res.reason;
        if (reason === "backoff" && typeof res.waitMs === "number") {
          const mins = Math.ceil(res.waitMs / 60000);
          toast("Saltado por backoff. Volvé a intentar en ~" + mins + " min.");
        } else if (reason === "invalid_credentials") {
          toast.error("Credenciales inválidas. Actualizá y reintentá.");
        } else if (reason === "no_credentials") {
          toast("No hay credenciales guardadas para este POS.");
        } else {
          toast("Sync omitido: " + String(reason));
        }
      } else {
        toast("Respuesta recibida del sync.");
      }
    } catch {
      toast.error("Error inesperado ejecutando el sync");
    } finally {
      setTesting(false);
    }
  }

  async function refresh() {
    if (!locationId) return;
    const { data, error } = await (supabase.rpc as any)("pos_provider_credentials_public", { _location_id: locationId });
    if (!error) setRows((data as CredRow[]) ?? []);
  }
  const selectedHints = (selectedRow?.masked_hints ?? {}) as Record<string, unknown>;

  return (
    <article>
      <Helmet>
        <title>POS de sucursal | TUPÁ Hub</title>
        <meta name="description" content="Detalle de integración POS por sucursal" />
        <link rel="canonical" href={`/app/locations/${locationId}/pos`} />
      </Helmet>
      <h1 className="sr-only">Detalle POS de sucursal</h1>

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>POS de la sucursal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            Cargando…
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle>POS de la sucursal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="text-destructive">{error}</div>
            <Button variant="secondary" onClick={() => navigate(-1)}>Volver</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">POS de la sucursal</CardTitle>
            {statusBadge(selectedRow?.status)}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider chips */}
            <div className="flex flex-wrap gap-2">
              {(["fudo", "bistrosoft", "maxirest", "other"] as AppPosProvider[]).map((p) => {
                const row = rows.find((r) => r.provider === p);
                return (
                  <Button
                    key={p}
                    variant={provider === p ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setProvider(p)}
                  >
                    <span className="mr-2">{providerLabels[p]}</span>
                    {row ? <Badge variant={statusToVariant(row.status) as any} className="capitalize">{row.status}</Badge> : <Badge variant="outline">sin datos</Badge>}
                  </Button>
                );
              })}
            </div>

            {/* Current info */}
            <div className="space-y-1 text-sm text-muted-foreground">
              {selectedRow ? (
                <>
                  {Object.keys(selectedHints).length > 0 ? (
                    <ul className="list-disc pl-5">
                      {Object.entries(selectedHints).map(([k, v]) => (
                        <li key={k}>
                          <span className="font-medium text-foreground mr-1">{k}:</span> {String(v)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Sin hints visibles.</p>
                  )}
                  {selectedRow.last_verified_at && (
                    <p className="text-xs">Última verificación: {new Date(selectedRow.last_verified_at).toLocaleString()}</p>
                  )}
                </>
              ) : (
                <p className="text-sm">Aún no hay credenciales guardadas para {providerLabels[provider]}.</p>
              )}
            </div>

            <Separator />

            {/* Forms by provider */}
            {provider === "fudo" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fudo-api">API key (requerido)</Label>
                  <Input id="fudo-api" value={fudo.apiKey} onChange={(e) => setFudo({ ...fudo, apiKey: e.target.value })} placeholder="fk_live_…" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fudo-secret">API secret (requerido)</Label>
                  <Input id="fudo-secret" type="password" value={fudo.apiSecret} onChange={(e) => setFudo({ ...fudo, apiSecret: e.target.value })} placeholder="••••••••" />
                </div>
                <div className="space-y-2 md:col-span-2 max-w-xs">
                  <Label htmlFor="fudo-env">Entorno</Label>
                  <Select value={fudo.env ?? "production"} onValueChange={(v) => setFudo({ ...fudo, env: v as any })}>
                    <SelectTrigger id="fudo-env">
                      <SelectValue placeholder="production" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="production">production</SelectItem>
                      <SelectItem value="staging">staging</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {provider === "bistrosoft" && (
              <div className="max-w-md space-y-2">
                <Label htmlFor="bs-api">API key (requerido)</Label>
                <Input id="bs-api" value={bistrosoft.apiKey} onChange={(e) => setBistrosoft({ apiKey: e.target.value })} placeholder="bs_live_…" />
              </div>
            )}

            {provider === "maxirest" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mx-api">API key (requerido)</Label>
                  <Input id="mx-api" value={maxirest.apiKey} onChange={(e) => setMaxirest({ ...maxirest, apiKey: e.target.value })} placeholder="mx_live_…" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mx-token">Token (opcional)</Label>
                  <Input id="mx-token" value={maxirest.token} onChange={(e) => setMaxirest({ ...maxirest, token: e.target.value })} placeholder="…" />
                </div>
              </div>
            )}

            {provider === "other" && (
              <div className="space-y-2">
                <Label htmlFor="other-json">JSON de credenciales (incluí apiKey)</Label>
                <textarea
                  id="other-json"
                  className="w-full min-h-40 rounded-md border bg-background p-3 text-sm"
                  value={otherJson}
                  onChange={(e) => setOtherJson(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={onSave} disabled={saving || verifying || testing} className="hover-scale">{saving ? "Guardando…" : "Guardar"}</Button>
              <Button onClick={onVerify} variant="secondary" disabled={verifying || saving || testing} className="hover-scale">{verifying ? "Verificando…" : "Probar"}</Button>
              <Button onClick={onTestSync} variant="secondary" disabled={testing || saving || verifying} className="hover-scale">{testing ? "Ejecutando…" : "Probar sync (ayer)"}</Button>
              <div className="ml-auto">
                <Button variant="outline" onClick={() => navigate(-1)}>Volver</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </article>
  );
}
