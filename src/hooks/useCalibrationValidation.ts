import { useMemo } from "react";

interface CalibrationParams {
  doseG: number;
  yieldValue: number;
  timeS: number;
  turno: string;
  selectedRecipeId: string | null;
  semaphoreStatus?: string;
}

interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

export function useCalibrationValidation(params: CalibrationParams): ValidationResult {
  return useMemo(() => {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Basic parameter validation
    if (params.doseG <= 0) {
      errors.push("La dosis debe ser mayor a 0");
    }
    if (params.yieldValue <= 0) {
      errors.push("El rendimiento debe ser mayor a 0");
    }
    if (params.timeS <= 0) {
      errors.push("El tiempo debe ser mayor a 0");
    }

    // Shift and recipe validation
    if (!params.turno) {
      errors.push("Debe seleccionar un turno");
    }
    if (!params.selectedRecipeId) {
      errors.push("Debe seleccionar una receta");
    }

    // Semaphore validation
    if (params.semaphoreStatus === "error") {
      errors.push("Los parámetros están fuera de rango aceptable");
    }

    // Range validations (business rules)
    if (params.doseG < 14 || params.doseG > 22) {
      warnings.push("Dosis fuera del rango típico (14-22g)");
    }
    if (params.yieldValue < 25 || params.yieldValue > 50) {
      warnings.push("Rendimiento fuera del rango típico (25-50g)");
    }
    if (params.timeS < 20 || params.timeS > 40) {
      warnings.push("Tiempo fuera del rango típico (20-40s)");
    }

    const isValid = errors.length === 0;

    return { isValid, warnings, errors };
  }, [
    params.doseG,
    params.yieldValue,
    params.timeS,
    params.turno,
    params.selectedRecipeId,
    params.semaphoreStatus,
  ]);
}

export function validateShiftWithCurrentTime(turno: string): {
  isValid: boolean;
  warning?: string;
} {
  const now = new Date();
  const hour = now.getHours();

  const expectedShift = 
    hour >= 6 && hour < 14 ? "morning" :
    hour >= 14 && hour < 22 ? "afternoon" :
    "night";

  if (turno !== expectedShift) {
    const shiftNames = {
      morning: "Mañana (6:00-14:00)",
      afternoon: "Tarde (14:00-22:00)",
      night: "Noche (22:00-6:00)"
    };

    return {
      isValid: false,
      warning: `El turno seleccionado (${shiftNames[turno as keyof typeof shiftNames] || turno}) no coincide con la hora actual. Se esperaría ${shiftNames[expectedShift]}.`
    };
  }

  return { isValid: true };
}

export function detectDrasticChanges(
  currentParams: { doseG: number; yieldValue: number; timeS: number; tempC: number },
  previousParams?: { dose_g: number; yield_value: number; time_s: number; temp_c: number }
): string[] {
  if (!previousParams) return [];

  const changes: string[] = [];
  const threshold = 0.20; // 20%

  const doseChange = Math.abs((currentParams.doseG - previousParams.dose_g) / previousParams.dose_g);
  if (doseChange > threshold) {
    changes.push(`Dosis cambió ${(doseChange * 100).toFixed(0)}% (${previousParams.dose_g}g → ${currentParams.doseG}g)`);
  }

  const yieldChange = Math.abs((currentParams.yieldValue - previousParams.yield_value) / previousParams.yield_value);
  if (yieldChange > threshold) {
    changes.push(`Rendimiento cambió ${(yieldChange * 100).toFixed(0)}% (${previousParams.yield_value}g → ${currentParams.yieldValue}g)`);
  }

  const timeChange = Math.abs((currentParams.timeS - previousParams.time_s) / previousParams.time_s);
  if (timeChange > threshold) {
    changes.push(`Tiempo cambió ${(timeChange * 100).toFixed(0)}% (${previousParams.time_s}s → ${currentParams.timeS}s)`);
  }

  const tempChange = Math.abs((currentParams.tempC - previousParams.temp_c) / previousParams.temp_c);
  if (tempChange > 0.05) { // 5% for temperature
    changes.push(`Temperatura cambió ${(tempChange * 100).toFixed(1)}% (${previousParams.temp_c}°C → ${currentParams.tempC}°C)`);
  }

  return changes;
}
