import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { CalibrationCalculator } from "@/components/app/calibration/CalibrationCalculator";
import { CalibrationHistory } from "@/components/app/calibration/CalibrationHistory";
import { ActiveRecipesWidget } from "@/components/app/barista/ActiveRecipesWidget";
import { useTenant } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Coffee, History, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
        {/* Header - Mobile optimized */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                  <Coffee className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                  Calibración
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Tu estación de trabajo
                </p>
              </div>
              
              {/* Quick action button - Large and touch-friendly */}
              <Button 
                size="lg"
                onClick={() => setShowCalculator(true)}
                className="h-12 px-6 text-base shadow-lg"
              >
                <Zap className="h-5 w-5 mr-2" />
                Nueva Calibración
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
          
          {/* Active Recipes - What's being used today */}
          <ActiveRecipesWidget />

          {/* History Tabs - Mobile friendly */}
          <Tabs defaultValue="recent" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-12">
              <TabsTrigger value="recent" className="text-base">
                <History className="h-4 w-4 mr-2" />
                Mis Calibraciones
              </TabsTrigger>
              <TabsTrigger value="approved" className="text-base">
                <Coffee className="h-4 w-4 mr-2" />
                Aprobadas Hoy
              </TabsTrigger>
            </TabsList>

            <TabsContent value="recent" className="mt-6">
              <CalibrationHistory 
                locationId={locationId}
              />
            </TabsContent>

            <TabsContent value="approved" className="mt-6">
              <CalibrationHistory 
                locationId={locationId}
              />
            </TabsContent>
          </Tabs>
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
