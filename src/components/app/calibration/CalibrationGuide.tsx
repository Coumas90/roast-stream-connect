import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Lightbulb, 
  Target, 
  Clock, 
  Thermometer, 
  Scale,
  Coffee,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface CalibrationGuideProps {
  targetProfile?: {
    target_dose_g: number;
    target_ratio_min: number;
    target_ratio_max: number;
    target_time_min: number;
    target_time_max: number;
    target_temp_c: number;
  };
  currentValues?: {
    dose_g: number;
    ratio: number;
    time_s: number;
    temp_c: number;
    grind_points: number;
  };
  semaphoreStatus?: 'success' | 'warning' | 'error';
}

export function CalibrationGuide({ 
  targetProfile, 
  currentValues,
  semaphoreStatus = 'warning'
}: CalibrationGuideProps) {
  
  const getStatusIcon = (status: 'success' | 'warning' | 'error') => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
    }
  };

  const getStatusColor = (status: 'success' | 'warning' | 'error') => {
    switch (status) {
      case 'success':
        return 'border-green-500 bg-green-50';
      case 'warning':
        return 'border-amber-500 bg-amber-50';
      case 'error':
        return 'border-red-500 bg-red-50';
    }
  };

  // Check individual parameters
  const timeStatus = currentValues && targetProfile
    ? currentValues.time_s >= targetProfile.target_time_min && 
      currentValues.time_s <= targetProfile.target_time_max
      ? 'success' : 'warning'
    : undefined;

  const ratioStatus = currentValues && targetProfile
    ? currentValues.ratio >= targetProfile.target_ratio_min && 
      currentValues.ratio <= targetProfile.target_ratio_max
      ? 'success' : 'warning'
    : undefined;

  const tempStatus = currentValues && targetProfile
    ? Math.abs(currentValues.temp_c - targetProfile.target_temp_c) <= 2
      ? 'success' : 'warning'
    : undefined;

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <Alert className={cn("border-2", getStatusColor(semaphoreStatus))}>
        <div className="flex items-start gap-3">
          {getStatusIcon(semaphoreStatus)}
          <div className="flex-1">
            <AlertDescription className="font-medium">
              {semaphoreStatus === 'success' && "¡Excelente! Parámetros dentro del rango objetivo"}
              {semaphoreStatus === 'warning' && "Ajustes necesarios - Revisar parámetros"}
              {semaphoreStatus === 'error' && "Fuera de rango - Requiere ajustes significativos"}
            </AlertDescription>
          </div>
        </div>
      </Alert>

      {/* Parameter Status Cards */}
      {currentValues && targetProfile && (
        <div className="grid grid-cols-3 gap-3">
          {/* Time Status */}
          <Card className={cn("p-3 border-2", timeStatus === 'success' ? 'border-green-500' : 'border-amber-500')}>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">Tiempo</span>
            </div>
            <div className="font-mono text-lg font-bold">
              {currentValues.time_s}s
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Objetivo: {targetProfile.target_time_min}-{targetProfile.target_time_max}s
            </div>
          </Card>

          {/* Ratio Status */}
          <Card className={cn("p-3 border-2", ratioStatus === 'success' ? 'border-green-500' : 'border-amber-500')}>
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4" />
              <span className="text-xs font-medium">Ratio</span>
            </div>
            <div className="font-mono text-lg font-bold">
              {currentValues.ratio.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Objetivo: {targetProfile.target_ratio_min}-{targetProfile.target_ratio_max}
            </div>
          </Card>

          {/* Temperature Status */}
          <Card className={cn("p-3 border-2", tempStatus === 'success' ? 'border-green-500' : 'border-amber-500')}>
            <div className="flex items-center gap-2 mb-1">
              <Thermometer className="h-4 w-4" />
              <span className="text-xs font-medium">Temp</span>
            </div>
            <div className="font-mono text-lg font-bold">
              {currentValues.temp_c}°C
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Objetivo: {targetProfile.target_temp_c}°C ±2
            </div>
          </Card>
        </div>
      )}

      {/* Visual Rules Accordion */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="extraction-rules">
          <AccordionTrigger className="text-sm font-semibold">
            <div className="flex items-center gap-2">
              <Coffee className="h-4 w-4" />
              Reglas de Extracción
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 text-sm">
                <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Sub-extraído (Ácido/Salado)</p>
                  <p className="text-muted-foreground text-xs">
                    → Cerrar molienda 0.3-0.5 puntos o aumentar tiempo/temperatura
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-sm">
                <TrendingDown className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Sobre-extraído (Amargo/Astringente)</p>
                  <p className="text-muted-foreground text-xs">
                    → Abrir molienda 0.3-0.5 puntos o reducir temperatura 1-2°C
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Balanceado</p>
                  <p className="text-muted-foreground text-xs">
                    → Dulce, ácido brillante, cuerpo sedoso - mantener parámetros
                  </p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="adjustment-guide">
          <AccordionTrigger className="text-sm font-semibold">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Guía de Ajustes
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pt-2">
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm font-medium mb-2">Ajustar Molienda:</p>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• Más fina (cerrar) → Mayor tiempo de extracción, más cuerpo</li>
                  <li>• Más gruesa (abrir) → Menor tiempo, más ácido brillante</li>
                  <li>• Máximo cambio seguro: ±1.5 puntos por ajuste</li>
                </ul>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm font-medium mb-2">Ajustar Dosis:</p>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• +0.5g → Más cuerpo y dulzor</li>
                  <li>• -0.5g → Más acidez y claridad</li>
                  <li>• Mantener ratio constante ajustando rendimiento</li>
                </ul>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm font-medium mb-2">Ajustar Temperatura:</p>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• +2°C → Mayor extracción, más amargor potencial</li>
                  <li>• -2°C → Menor extracción, más acidez</li>
                  <li>• Rango seguro: 90-95°C para la mayoría de cafés</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="future-tds">
          <AccordionTrigger className="text-sm font-semibold">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Próximamente: TDS & EY%
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pt-2">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  La integración con refractómetro TDS permitirá medir objetivamente la calidad de extracción
                </AlertDescription>
              </Alert>

              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm font-medium mb-2">Métricas planificadas:</p>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• <strong>TDS (Total Dissolved Solids)</strong>: 1.15-1.45% para espresso</li>
                  <li>• <strong>EY% (Extraction Yield)</strong>: 18-22% rango óptimo</li>
                  <li>• Gráficos en tiempo real de calidad de extracción</li>
                  <li>• Histórico de TDS para cada café y lote</li>
                  <li>• Correlación automática con parámetros de calibración</li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <p className="text-xs text-blue-900">
                  <strong>Conecta tu refractómetro Atago, VST o DiFluid</strong> cuando esta funcionalidad esté disponible
                  para obtener mediciones precisas de TDS y EY%.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Quick Tips */}
      <Card className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start gap-2">
          <Lightbulb className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-900 mb-1">Consejo del día</p>
            <p className="text-xs text-blue-800">
              Mantén la consistencia del apisonado y la distribución del café. 
              Un apisonado desigual puede generar canalizaciones que afectan la extracción 
              más que cualquier ajuste de parámetros.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
