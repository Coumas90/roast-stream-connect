import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Navigate } from "react-router-dom";
import { useTenant } from "@/lib/tenant";
import { useUserRole } from "@/hooks/useTeam";
import type { AppPosProvider } from "@/integrations/supabase/pos-types";
const providerLabels: Record<AppPosProvider, string> = {
  fudo: "Fudo",
  maxirest: "Maxirest",
  bistrosoft: "Bistrosoft",
  other: "ERP/Otro",
};

type CredRow = {
  location_id: string;
  provider: AppPosProvider;
  masked_hints: Record<string, unknown>;
  status: string;
  last_verified_at: string | null;
  updated_at: string;
};

export default function AppIntegrations() {
  const navigate = useNavigate();
  const { tenantId } = useTenant();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [byLoc, setByLoc] = useState<Record<string, CredRow[]>>({});

  const { data: effectiveRole } = useUserRole();
  if (effectiveRole && !['owner','manager','tupa_admin'].includes(effectiveRole)) {
    return <Navigate to="/app" replace />;
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!tenantId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: locs, error: locErr } = await supabase
          .from("locations")
          .select("id,name,tenant_id")
          .eq("tenant_id", tenantId);
        if (locErr) throw locErr;
        if (cancelled) return;
        const locList = (locs ?? []).map((l: any) => ({ id: l.id as string, name: l.name as string }));
        setLocations(locList);

        // Fetch credentials for each location in parallel
        const results = await Promise.all(
          locList.map(async (loc) => {
            const { data, error } = await (supabase.rpc as any)("pos_provider_credentials_public", { _location_id: loc.id });
            if (error) {
              // Per-location errors shouldn't break the whole page; surface later
              return { id: loc.id, rows: [], err: error } as { id: string; rows: CredRow[]; err?: any };
            }
            return { id: loc.id, rows: (data as CredRow[]) ?? [] } as { id: string; rows: CredRow[] };
          })
        );
        if (cancelled) return;
        const map: Record<string, CredRow[]> = {};
        results.forEach((r) => {
          map[r.id] = r.rows;
        });
        setByLoc(map);
      } catch (e: any) {
        setError(e?.message ?? "Error al cargar integraciones");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const latestByLoc = useMemo(() => {
    const out: Record<string, CredRow | null> = {};
    for (const loc of locations) {
      const rows = byLoc[loc.id] ?? [];
      if (!rows.length) {
        out[loc.id] = null;
      } else {
        const sorted = [...rows].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        out[loc.id] = sorted[0];
      }
    }
    return out;
  }, [locations, byLoc]);

  const statusToVariant = (status?: string) => {
    const s = (status ?? "").toLowerCase();
    return s === "connected" ? "success" : s === "pending" ? "warning" : s === "invalid" ? "destructive" : "outline";
  };

  const statusBadge = (status?: string) => {
    const s = (status ?? "").toLowerCase();
    const variant = statusToVariant(s);
    const label = s ? s : "sin datos";
    return <Badge variant={variant as any} className="capitalize">{label}</Badge>;
  };

  return (
    <article>
      <Helmet>
        <title>Integraciones POS | TUPÁ Hub</title>
        <meta name="description" content="Estado del POS por sucursal del tenant" />
        <link rel="canonical" href="/app/settings/integrations" />
      </Helmet>
      <h1 className="sr-only">Integraciones POS</h1>

      <Tabs defaultValue="pos">
        <TabsList>
          <TabsTrigger value="pos">POS</TabsTrigger>
        </TabsList>

        <TabsContent value="pos">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-40" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-9 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : locations.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>POS</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">No tenés acceso o no hay sucursales disponibles.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {locations.map((loc) => {
                const latest = latestByLoc[loc.id];
                const hints = latest?.masked_hints as Record<string, unknown> | undefined;
                return (
                  <Card key={loc.id}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-base font-semibold">{loc.name}</CardTitle>
                      {statusBadge(latest?.status)}
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      {(byLoc[loc.id]?.length ?? 0) > 1 && (
                        <div className="flex flex-wrap gap-2">
                          {byLoc[loc.id].map((r) => (
                            <Badge key={`${loc.id}-${r.provider}-${r.updated_at}`} variant={statusToVariant(r.status) as any} className="capitalize">
                              {providerLabels[r.provider]} • {r.status}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {!latest ? (
                        <p>Sin credenciales aún.</p>
                      ) : (
                        <>
                          {hints && Object.keys(hints).length > 0 ? (
                            <ul className="list-disc pl-5">
                              {Object.entries(hints).map(([k, v]) => (
                                <li key={k}>
                                  <span className="font-medium text-foreground mr-1">{k}:</span> {String(v)}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p>Sin datos visibles.</p>
                          )}
                          {latest.last_verified_at && (
                            <p className="text-xs">Última verificación: {new Date(latest.last_verified_at).toLocaleString()}</p>
                          )}
                        </>
                      )}
                      <div className="pt-2">
                        <Button size="sm" onClick={() => navigate(`/app/locations/${loc.id}/pos`)}>
                          Abrir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </article>
  );
}
