import { Helmet } from "react-helmet-async";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import React from "react";
import PosConnectModal from "@/components/app/PosConnectModal";
import { useEffectivePos } from "@/hooks/usePosProvider";
import { useUserRole } from "@/hooks/useTeam";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import type { AppPosProvider } from "@/integrations/supabase/pos-types";

const data = [
  { name: "Ene", consumo: 12 },
  { name: "Feb", consumo: 14 },
  { name: "Mar", consumo: 13 },
  { name: "Abr", consumo: 15 },
  { name: "May", consumo: 16 },
  { name: "Jun", consumo: 18 },
];

export default function AppHome() {
  const { provider, source, connected, isLoading } = useEffectivePos();
  const { data: userRole } = useUserRole();
  const { flags, posEffective } = useFeatureFlags();
  const canManage = userRole === "owner" || userRole === "manager" || userRole === "tupa_admin";
  const [open, setOpen] = React.useState(false);
  const [defaultProvider, setDefaultProvider] = React.useState<AppPosProvider | undefined>(undefined);
  return (
    <>
      <Helmet>
        <title>TUPÁ Hub – Dashboard cliente</title>
        <meta name="description" content="Monitorea consumo real, stock y reposición automática con TUPÁ Hub." />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : '/app'} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "TUPÁ Hub",
          applicationCategory: "BusinessApplication",
          offers: { "@type": "Offer", price: "0" }
        })}</script>
      </Helmet>
      {/* POS status card */}
      <section className="grid gap-4 mt-2">
        <Card>
          <CardHeader>
            <CardTitle>POS</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4 justify-between">
            <div className="text-sm">
              {isLoading ? "Cargando…" : connected ? "Conectado" : "Desconectado"}
              {!posEffective && !isLoading ? (
                <div className="text-muted-foreground text-xs mt-1">
                  {flags.auto_order_enabled ? (!connected ? "POS no conectado" : null) : "Auto‑orden deshabilitado"}
                </div>
              ) : null}
            </div>
            <div className="text-sm text-muted-foreground">
              {!isLoading && (
                <>
                  <span className="mr-4">Proveedor: {provider ? ({ fudo: "Fudo", maxirest: "Maxirest", bistrosoft: "Bistrosoft", other: "ERP/Otro" } as Record<AppPosProvider, string>)[provider] : "—"}</span>
                  <span>Origen: {source ? (source === "location" ? "Sucursal" : "Tenant") : "—"}</span>
                </>
              )}
            </div>
            {canManage && !isLoading && !connected ? (
              <Button onClick={() => { setDefaultProvider(undefined); setOpen(true); }}>Conectar ahora</Button>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {/* Metrics grid */}
      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Stock Actual</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">45kg</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Consumo Mensual</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">28kg</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cobertura</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">32 días</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Eficiencia</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">87%</CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3 mt-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Consumo Mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ consumo: { label: "Consumo (kg)", color: "hsl(var(--primary))" } }}
              className="h-[320px]"
            >
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="consumo" fill="var(--color-consumo)" radius={6} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recomendación de Reposición</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Basado en tu ritmo de consumo actual y stock disponible.</p>
            <div className="flex items-center gap-3">
              <div className="text-4xl font-semibold">25kg</div>
              <div className="text-sm">Finca La Esperanza<br />en 8 días</div>
            </div>
            <Button className="mt-4" variant="soft">Aplicar Recomendación</Button>
          </CardContent>
        </Card>
      </section>
      <PosConnectModal open={open} onOpenChange={setOpen} defaultProvider={defaultProvider} />
    </>
  );
}