import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { validateShiftWithCurrentTime } from "@/hooks/useCalibrationValidation";

interface ShiftValidatorProps {
  turno: string;
}

export function ShiftValidator({ turno }: ShiftValidatorProps) {
  if (!turno) return null;

  const validation = validateShiftWithCurrentTime(turno);

  if (validation.isValid) return null;

  return (
    <Alert variant="default" className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        {validation.warning}
      </AlertDescription>
    </Alert>
  );
}
