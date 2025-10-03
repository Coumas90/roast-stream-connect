import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Zap, RotateCcw, TrendingUp } from "lucide-react";
import { useBaristaMetrics } from "@/hooks/useBaristaMetrics";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";

interface BaristaHeroSectionProps {
  onNewCalibration: () => void;
  onRepeatLast: () => void;
}

export function BaristaHeroSection({ onNewCalibration, onRepeatLast }: BaristaHeroSectionProps) {
  const { profile } = useProfile();
  const { data: metrics } = useBaristaMetrics(profile?.id);

  const getCurrentShift = () => {
    const hour = new Date().getHours();
    if (hour < 14) return "Mañana";
    if (hour < 20) return "Tarde";
    return "Noche";
  };

  const dailyGoal = 5;
  const todayCount = metrics?.todayCalibrations || 0;
  const todayApproved = metrics?.todayApproved || 0;
  const progressPercent = Math.min((todayCount / dailyGoal) * 100, 100);

  return (
    <Card className="shadow-elegant border-0 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardContent className="p-6 space-y-6">
        {/* Shift & Stats */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">☕</span>
              <h2 className="text-xl font-bold">Turno: {getCurrentShift()}</h2>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <span>Hoy: <span className="font-semibold text-foreground">{todayCount}</span> calibraciones</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">✅</span>
                <span><span className="font-semibold text-green-600">{todayApproved}</span> aprobadas</span>
              </div>
            </div>
          </div>
          
          {/* Success Rate Badge */}
          {todayCount > 0 && (
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">
                {Math.round((todayApproved / todayCount) * 100)}%
              </div>
              <div className="text-xs text-muted-foreground">Aprobación</div>
            </div>
          )}
        </div>

        {/* Goal Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">🎯 Meta del día</span>
            <span className="font-semibold">{todayCount} / {dailyGoal}</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          {progressPercent >= 100 && (
            <p className="text-xs text-green-600 font-medium animate-fade-in">
              🎉 ¡Meta cumplida! Excelente trabajo
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            onClick={onNewCalibration}
            className="h-14 text-base font-semibold shadow-lg hover-scale"
          >
            <Zap className="h-5 w-5 mr-2" />
            Nueva Calibración
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onRepeatLast}
            className="h-14 text-base hover-scale"
            disabled={!metrics?.lastCalibrationTime}
          >
            <RotateCcw className="h-5 w-5 mr-2" />
            Repetir Última
          </Button>
        </div>

        {/* Last Calibration Time */}
        {metrics?.lastCalibrationTime && (
          <p className="text-xs text-muted-foreground text-center">
            Última calibración: {new Date(metrics.lastCalibrationTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
