import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { BaristaKPIGrid } from "@/components/app/barista/BaristaKPIGrid";
import { QuickCalibrationWidget } from "@/components/app/barista/QuickCalibrationWidget";
import { ActiveRecipesWidget } from "@/components/app/barista/ActiveRecipesWidget";
import { PersonalHistoryWidget } from "@/components/app/barista/PersonalHistoryWidget";
import { BaristaPerformanceChart } from "@/components/app/barista/BaristaPerformanceChart";
import { BaristaInsightsWidget } from "@/components/app/barista/BaristaInsightsWidget";
import { BaristaBadgesWidget } from "@/components/app/barista/BaristaBadgesWidget";
import { Coffee, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BaristaHome() {
  const navigate = useNavigate();
  return (
    <>
      <Helmet>
        <title>TUPÁ Hub – Mi Dashboard Barista</title>
        <meta name="description" content="Dashboard especializado para baristas con herramientas de calibración, recetas activas y métricas de desempeño." />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : '/app/barista'} />
      </Helmet>
      
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <section className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-xl bg-gradient-brand shadow-glow">
            <Coffee className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-brand bg-clip-text text-transparent">
              Mi Dashboard Barista
            </h1>
            <p className="text-muted-foreground mt-1">
              Herramientas y métricas para tu trabajo diario con el café
            </p>
          </div>
        </section>

        {/* KPI Grid */}
        <BaristaKPIGrid />

        {/* Main Grid */}
        <section className="grid gap-6 lg:grid-cols-3">
          {/* Left - Quick Calibration (Takes 2 cols) */}
          <div className="lg:col-span-2 relative group">
            <QuickCalibrationWidget />
            <Button 
              size="lg"
              onClick={() => navigate('/app/barista/calibration')}
              className="absolute top-4 right-4 shadow-glow z-10"
            >
              <Zap className="h-4 w-4 mr-2" />
              Ir a Calibración
            </Button>
          </div>
          
          {/* Right - Active Recipes */}
          <div className="lg:col-span-1">
            <ActiveRecipesWidget />
          </div>
        </section>

        {/* Performance & History Grid */}
        <section className="grid gap-6 lg:grid-cols-2">
          {/* Performance Chart */}
          <BaristaPerformanceChart />
          
          {/* Personal History */}
          <PersonalHistoryWidget />
        </section>

        {/* Insights & Badges Grid */}
        <section className="grid gap-6 lg:grid-cols-2">
          {/* Insights */}
          <BaristaInsightsWidget />
          
          {/* Badges */}
          <BaristaBadgesWidget />
        </section>
      </div>
    </>
  );
}
