import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { CalibrationCalculator } from "@/components/app/calibration/CalibrationCalculator";
import { BaristaHeroSection } from "@/components/app/barista/BaristaHeroSection";
import { CoffeeEvolutionTimeline } from "@/components/app/barista/CoffeeEvolutionTimeline";
import { CalibrationHistoryCards } from "@/components/app/barista/CalibrationHistoryCards";
import { ActiveRecipesWidget } from "@/components/app/barista/ActiveRecipesWidget";
import { CoffeeEvolutionChart } from "@/components/app/barista/CoffeeEvolutionChart";
import { BaristaBadgesWidget } from "@/components/app/barista/BaristaBadgesWidget";
import { useTenant } from "@/lib/tenant";
import { Coffee } from "lucide-react";

export default function BaristaCalibration() {
  const [showCalculator, setShowCalculator] = useState(false);
  const { locationId } = useTenant();

  return (
    <>
      <Helmet>
        <title>Calibración - TUPÁ Hub</title>
        <meta name="description" content="Herramienta de calibración rápida para baristas" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-20">
        {/* Header - Clean and Simple */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container max-w-7xl mx-auto px-4 py-4">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Coffee className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              Calibración
            </h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
          
          {/* Hero Section - Daily Progress & Quick Actions */}
          <BaristaHeroSection 
            onNewCalibration={() => setShowCalculator(true)}
            onRepeatLast={() => setShowCalculator(true)}
          />

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Coffee Evolution Timeline */}
              <CoffeeEvolutionTimeline />
              
              {/* Coffee Evolution Chart */}
              <CoffeeEvolutionChart />
              
              {/* Active Recipes */}
              <ActiveRecipesWidget />
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Badges & Achievements */}
              <BaristaBadgesWidget />
              
              {/* My Calibrations */}
              <CalibrationHistoryCards />
            </div>
          </div>
        </div>

        {/* Calibration Calculator Modal */}
        <CalibrationCalculator 
          open={showCalculator}
          onOpenChange={setShowCalculator}
          locationId={locationId}
        />
      </div>
    </>
  );
}
