import { Helmet } from "react-helmet-async";
import { CalibrationCompare } from "@/components/app/calibration/CalibrationCompare";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CalibrationComparePage() {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Comparación de Calibraciones - TUPÁ Hub</title>
        <meta name="description" content="Compara métricas de calibración entre sucursales" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-20">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
              <h1 className="text-2xl md:text-3xl font-bold">
                Comparación de Calibraciones
              </h1>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container max-w-7xl mx-auto px-4 py-6">
          <CalibrationCompare />
        </div>
      </div>
    </>
  );
}
