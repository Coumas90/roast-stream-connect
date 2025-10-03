import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Coffee, TrendingUp, StickyNote } from "lucide-react";

interface QuickActionsWidgetProps {
  onRepeatLast: () => void;
  onNewCalibration: () => void;
  onViewEvolution: () => void;
  lastCalibrationTime?: string;
}

export function QuickActionsWidget({
  onRepeatLast,
  onNewCalibration,
  onViewEvolution,
  lastCalibrationTime,
}: QuickActionsWidgetProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="text-xl">⚡</span>
          Acciones Rápidas
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-20 flex-col gap-2 hover-scale"
          onClick={onRepeatLast}
          disabled={!lastCalibrationTime}
        >
          <RotateCcw className="h-5 w-5" />
          <span className="text-xs font-medium">Repetir Última</span>
        </Button>

        <Button
          variant="outline"
          className="h-20 flex-col gap-2 hover-scale"
          onClick={onNewCalibration}
        >
          <Coffee className="h-5 w-5" />
          <span className="text-xs font-medium">Nueva Calibración</span>
        </Button>

        <Button
          variant="outline"
          className="h-20 flex-col gap-2 hover-scale"
          onClick={onViewEvolution}
        >
          <TrendingUp className="h-5 w-5" />
          <span className="text-xs font-medium">Ver Evolución</span>
        </Button>

        <Button
          variant="outline"
          className="h-20 flex-col gap-2 hover-scale"
          onClick={() => {
            // Scroll to notes section or open notes dialog
            const notesSection = document.querySelector('[data-notes-section]');
            if (notesSection) {
              notesSection.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        >
          <StickyNote className="h-5 w-5" />
          <span className="text-xs font-medium">Notas Rápidas</span>
        </Button>
      </CardContent>
    </Card>
  );
}
