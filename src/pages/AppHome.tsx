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
import { TrainingWidget } from "@/components/app/dashboard/TrainingWidget";
import { useTrainingEnabled } from "@/hooks/useTrainingRequests";
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
  
  // Check if training is enabled for this location
  const { data: trainingEnabled = false } = useTrainingEnabled(locationId);
  
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
      
      <div className="space-y-8 animate-fade-in">
        {/* Header with Status & Training */}
        <section className="grid gap-6 mt-2">
          <div className={`grid gap-6 ${trainingEnabled ? 'md:grid-cols-3' : 'grid-cols-1'}`}>
            {/* System Status - Enhanced Design */}
            <Card className={`${trainingEnabled ? 'md:col-span-2' : ''} bg-gradient-card shadow-soft hover-lift border-0`}>
              <CardHeader className={`${trainingEnabled ? 'pb-4' : 'pb-6'} border-b border-border/50`}>
                <CardTitle className="flex items-center gap-3 text-lg font-semibold">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  Estado del Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className={`${trainingEnabled ? 'py-4' : 'py-6'} flex flex-wrap items-center gap-4 justify-between`}>
                <div className="flex items-center gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant={connected ? "default" : "secondary"} className="font-medium">
                        POS {isLoading ? "Cargando…" : connected ? "Conectado" : "Desconectado"}
                      </Badge>
                      {lowStockItems.length > 0 && (
                        <Badge variant="destructive" className="animate-pulse-soft">
                          {lowStockItems.length} stock bajo
                        </Badge>
                      )}
                      {pendingOrders > 0 && (
                        <Badge variant="outline" className="border-warning text-warning">
                          {pendingOrders} pedidos pendientes
                        </Badge>
                      )}
                    </div>
                    {!posEffective && !isLoading && !trainingEnabled && (
                      <div className="text-muted-foreground text-sm">
                        {flags.auto_order_enabled ? (!connected ? "Tu POS no está conectado en esta sucursal." : null) : "Auto‑orden deshabilitado"}
                      </div>
                    )}
                  </div>
                </div>
                {!trainingEnabled && (
                  <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                    {!isLoading && (
                      <>
                        <div>Proveedor: <span className="font-medium">{provider ? ({ fudo: "Fudo", maxirest: "Maxirest", bistrosoft: "Bistrosoft", other: "ERP/Otro" } as Record<AppPosProvider, string>)[provider] : "—"}</span></div>
                        <div>Origen: <span className="font-medium">{source ? (source === "location" ? "Sucursal" : "Tenant") : "—"}</span></div>
                      </>
                    )}
                  </div>
                )}
                {canManage && !isLoading && !connected && (
                  <Button 
                    onClick={() => { setDefaultProvider(undefined); setOpen(true); }} 
                    size={trainingEnabled ? "sm" : "default"}
                    className="bg-gradient-brand hover:shadow-glow transition-all duration-300"
                  >
                    Conectar ahora
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Training Widget - Enhanced Position */}
            {trainingEnabled && (
              <div className="md:col-span-1 animate-slide-up">
                <TrainingWidget locationId={locationId || ""} />
              </div>
            )}
          </div>
        </section>

        {/* Enhanced KPI Grid */}
        <section className="grid gap-6 md:grid-cols-4">
          <div className="animate-scale-in" style={{ animationDelay: '0.1s' }}>
            <KPITile
              title="Stock Total"
              value={`${Math.round(totalStock)}kg`}
              delta={lowStockItems.length > 0 ? -15 : 5}
              className="hover-lift shadow-soft border-0 bg-gradient-card"
            />
          </div>
          <div className="animate-scale-in" style={{ animationDelay: '0.2s' }}>
            <KPITile
              title="Consumo Estimado"
              value={`${estimatedCoffeeKg}kg`}
              delta={12}
              className="hover-lift shadow-soft border-0 bg-gradient-card"
            />
          </div>
          <div className="animate-scale-in" style={{ animationDelay: '0.3s' }}>
            <KPITile
              title="Cobertura"
              value={coverageDays ? `${coverageDays} días` : "—"}
              delta={coverageDays && coverageDays < 7 ? -20 : 8}
              className="hover-lift shadow-soft border-0 bg-gradient-card"
            />
          </div>
          <div className="animate-scale-in" style={{ animationDelay: '0.4s' }}>
            <KPITile
              title="Valor Inventario"
              value={`$${Math.round(inventoryValue).toLocaleString()}`}
              delta={3}
              className="hover-lift shadow-soft border-0 bg-gradient-card"
            />
          </div>
        </section>

        {/* Main Dashboard Grid - Enhanced Layout */}
        <section className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Charts and Analytics */}
          <div className="lg:col-span-2 space-y-8">
            <div className="animate-slide-up" style={{ animationDelay: '0.5s' }}>
              <ConsumptionTrends locationId={locationId} />
            </div>
            <div className="animate-slide-up" style={{ animationDelay: '0.6s' }}>
              <StockOverview locationId={locationId} />
            </div>
          </div>
          
          {/* Right Column - Actions and Alerts */}
          <div className="space-y-8">
            <div className="animate-slide-up" style={{ animationDelay: '0.7s' }}>
              <StockAlerts locationId={locationId} />
            </div>
            <div className="animate-slide-up" style={{ animationDelay: '0.8s' }}>
              <QuickActions locationId={locationId} />
            </div>
            <div className="animate-slide-up" style={{ animationDelay: '0.9s' }}>
              <OrdersTimeline locationId={locationId} />
            </div>
          </div>
        </section>
      </div>
      
      <PosConnectModal open={open} onOpenChange={setOpen} defaultProvider={defaultProvider} />
    </>
  );
}