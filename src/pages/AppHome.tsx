import { Helmet } from "react-helmet-async";
import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PosConnectModal from "@/components/app/PosConnectModal";
import { useEffectivePos } from "@/hooks/usePosProvider";
import { useUserRole } from "@/hooks/useTeam";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useProfile } from "@/hooks/useProfile";
import { useTenant } from "@/lib/tenant";
import KPITile from "@/components/admin/dashboard/KPITile";
import { StockOverview } from "@/components/app/dashboard/StockOverview";
import { OrdersTimeline } from "@/components/app/dashboard/OrdersTimeline";
import { ConsumptionTrends } from "@/components/app/dashboard/ConsumptionTrends";
import { QuickActions } from "@/components/app/dashboard/QuickActions";
import { StockAlerts } from "@/components/app/dashboard/StockAlerts";
import { useStockMetrics } from "@/hooks/useLocationStock";
import { useOrderMetrics } from "@/hooks/useOrderHistory";
import { useConsumptionMetrics } from "@/hooks/useConsumptionMetrics";
import type { AppPosProvider } from "@/integrations/supabase/pos-types";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Package, Zap, Calendar, TrendingUp } from "lucide-react";

export default function AppHome() {
  const { provider, source, connected, isLoading } = useEffectivePos();
  const { data: userRole } = useUserRole();
  const { flags, posEffective } = useFeatureFlags();
  const { locationId } = useTenant();
  
  // Get real data for the dashboard
  const { totalStock, inventoryValue, lowStockItems, lastRefillDate } = useStockMetrics(locationId);
  const { pendingOrders, lastOrderDate, ordersByStatus } = useOrderMetrics(locationId);
  const { monthlyRevenue, estimatedCoffeeKg, dailyAverage } = useConsumptionMetrics(locationId);
  
  const canManage = userRole === "owner" || userRole === "manager" || userRole === "tupa_admin";
  const [open, setOpen] = React.useState(false);
  const [defaultProvider, setDefaultProvider] = React.useState<AppPosProvider | undefined>(undefined);
  
  // Calculate coverage days
  const coverageDays = dailyAverage > 0 ? Math.round((totalStock * 67) / dailyAverage) : null;
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
      {/* POS Status & Alerts */}
      <section className="grid gap-4 mt-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Estado del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={connected ? "default" : "secondary"}>
                    POS {isLoading ? "Cargando…" : connected ? "Conectado" : "Desconectado"}
                  </Badge>
                  {lowStockItems.length > 0 && (
                    <Badge variant="destructive">
                      {lowStockItems.length} stock bajo
                    </Badge>
                  )}
                  {pendingOrders > 0 && (
                    <Badge variant="outline">
                      {pendingOrders} pedidos pendientes
                    </Badge>
                  )}
                </div>
                {!posEffective && !isLoading && (
                  <div className="text-muted-foreground text-xs mt-1">
                    {flags.auto_order_enabled ? (!connected ? "Tu POS no está conectado en esta sucursal." : null) : "Auto‑orden deshabilitado"}
                  </div>
                )}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {!isLoading && (
                <>
                  <span className="mr-4">Proveedor: {provider ? ({ fudo: "Fudo", maxirest: "Maxirest", bistrosoft: "Bistrosoft", other: "ERP/Otro" } as Record<AppPosProvider, string>)[provider] : "—"}</span>
                  <span>Origen: {source ? (source === "location" ? "Sucursal" : "Tenant") : "—"}</span>
                </>
              )}
            </div>
            {canManage && !isLoading && !connected && (
              <Button onClick={() => { setDefaultProvider(undefined); setOpen(true); }}>
                Conectar ahora
              </Button>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Enhanced KPI Grid */}
      <section className="grid gap-4 md:grid-cols-4">
        <KPITile
          title="Stock Total"
          value={`${Math.round(totalStock)}kg`}
          delta={lowStockItems.length > 0 ? -15 : 5}
        />
        <KPITile
          title="Consumo Estimado"
          value={`${estimatedCoffeeKg}kg`}
          delta={12}
        />
        <KPITile
          title="Cobertura"
          value={coverageDays ? `${coverageDays} días` : "—"}
          delta={coverageDays && coverageDays < 7 ? -20 : 8}
        />
        <KPITile
          title="Valor Inventario"
          value={`$${Math.round(inventoryValue).toLocaleString()}`}
          delta={3}
        />
      </section>

      {/* Main Dashboard Grid */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Charts and Analytics */}
        <div className="lg:col-span-2 space-y-6">
          <ConsumptionTrends locationId={locationId} />
          <StockOverview locationId={locationId} />
        </div>
        
        {/* Right Column - Actions and Alerts */}
        <div className="space-y-6">
          <StockAlerts locationId={locationId} />
          <QuickActions locationId={locationId} />
          <OrdersTimeline locationId={locationId} />
        </div>
      </section>
      <PosConnectModal open={open} onOpenChange={setOpen} defaultProvider={defaultProvider} />
    </>
  );
}