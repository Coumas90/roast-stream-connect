/**
 * Utilidades para cálculos y validaciones de calibración
 */

export interface CalibrationValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SuggestionParams {
  timeS: number;
  ratio: number;
  targetTimeMin: number;
  targetTimeMax: number;
  targetRatioMin: number;
  targetRatioMax: number;
  notesTags: string[];
  grindDelta?: number;
  maxGrindDelta?: number;
}

export interface SemaphoreStatus {
  timeStatus: "good" | "warning" | "error";
  ratioStatus: "good" | "warning" | "error";
  overallStatus: "good" | "warning" | "error";
}

/**
 * Calcula el ratio de extracción con conversión automática ml -> g
 */
export function calculateRatio(
  yieldValue: number,
  yieldUnit: "g" | "ml",
  doseG: number,
  density: number = 0.98
): number {
  if (doseG <= 0) return 0;
  const yieldG = yieldUnit === "ml" ? yieldValue * density : yieldValue;
  return Number((yieldG / doseG).toFixed(2));
}

/**
 * Valida los parámetros de calibración
 */
export function validateCalibration(
  doseG: number,
  yieldValue: number,
  timeS: number,
  grindDelta: number = 0,
  maxGrindDelta: number = 1.5
): CalibrationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validaciones críticas
  if (doseG <= 0) {
    errors.push("La dosis debe ser mayor a 0g");
  }

  if (yieldValue <= 0) {
    errors.push("El rendimiento debe ser mayor a 0");
  }

  if (timeS <= 0) {
    errors.push("El tiempo debe ser mayor a 0 segundos");
  }

  // Validaciones de advertencia
  if (doseG > 0 && doseG < 10) {
    warnings.push("Dosis muy baja: verifique que sea correcta");
  }

  if (doseG > 30) {
    warnings.push("Dosis muy alta: verifique que sea correcta");
  }

  if (Math.abs(grindDelta) > maxGrindDelta) {
    warnings.push(
      `Cambio de molienda muy brusco (${Math.abs(grindDelta).toFixed(1)} puntos). Recomendado: máximo ${maxGrindDelta} puntos por ajuste`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Evalúa el estado del semáforo basado en rangos objetivo
 */
export function evaluateSemaphore(params: {
  timeS: number;
  ratio: number;
  targetTimeMin: number;
  targetTimeMax: number;
  targetRatioMin: number;
  targetRatioMax: number;
}): SemaphoreStatus {
  const { timeS, ratio, targetTimeMin, targetTimeMax, targetRatioMin, targetRatioMax } = params;

  // Time status
  let timeStatus: "good" | "warning" | "error" = "good";
  const timeDeltaMin = targetTimeMin - timeS;
  const timeDeltaMax = timeS - targetTimeMax;

  if (timeDeltaMin > 3 || timeDeltaMax > 3) {
    // > 3 segundos fuera de rango = error
    timeStatus = "error";
  } else if (timeDeltaMin > 0 || timeDeltaMax > 0) {
    // Fuera de rango pero <= 3 segundos = warning
    timeStatus = "warning";
  }

  // Ratio status
  let ratioStatus: "good" | "warning" | "error" = "good";
  const ratioDeltaMin = targetRatioMin - ratio;
  const ratioDeltaMax = ratio - targetRatioMax;

  if (ratioDeltaMin > 0.3 || ratioDeltaMax > 0.3) {
    // > 0.3 fuera de rango = error
    ratioStatus = "error";
  } else if (ratioDeltaMin > 0 || ratioDeltaMax > 0) {
    // Fuera de rango pero <= 0.3 = warning
    ratioStatus = "warning";
  }

  // Overall status
  let overallStatus: "good" | "warning" | "error" = "good";
  if (timeStatus === "error" || ratioStatus === "error") {
    overallStatus = "error";
  } else if (timeStatus === "warning" || ratioStatus === "warning") {
    overallStatus = "warning";
  }

  return { timeStatus, ratioStatus, overallStatus };
}

/**
 * Genera sugerencias inteligentes basadas en parámetros
 */
export function generateSuggestions(params: SuggestionParams): string {
  const {
    timeS,
    ratio,
    targetTimeMin,
    targetTimeMax,
    targetRatioMin,
    targetRatioMax,
    notesTags,
    grindDelta = 0,
    maxGrindDelta = 1.5,
  } = params;

  const suggestions: string[] = [];

  // Análisis de tiempo
  if (timeS < targetTimeMin) {
    const delta = targetTimeMin - timeS;
    if (delta > 5) {
      suggestions.push("⚠️ Tiempo muy bajo: cerrar molienda 0.5-1.0 puntos o aumentar dosis +0.5g");
    } else {
      suggestions.push("Cerrar molienda 0.3 puntos o aumentar dosis +0.2g");
    }
  } else if (timeS > targetTimeMax) {
    const delta = timeS - targetTimeMax;
    if (delta > 5) {
      suggestions.push("⚠️ Tiempo muy alto: abrir molienda 0.5-1.0 puntos o reducir dosis -0.5g");
    } else {
      suggestions.push("Abrir molienda 0.3 puntos o reducir dosis -0.2g");
    }
  }

  // Análisis de ratio
  if (ratio < targetRatioMin) {
    const delta = targetRatioMin - ratio;
    if (delta > 0.5) {
      suggestions.push("⚠️ Ratio muy bajo: aumentar rendimiento significativamente (+5-10g)");
    } else {
      suggestions.push("Ratio bajo: aumentar rendimiento (+2-3g)");
    }
  } else if (ratio > targetRatioMax) {
    const delta = ratio - targetRatioMax;
    if (delta > 0.5) {
      suggestions.push("⚠️ Ratio muy alto: reducir rendimiento significativamente (-5-10g)");
    } else {
      suggestions.push("Ratio alto: reducir rendimiento (-2-3g)");
    }
  }

  // Análisis de notas de sabor (siempre considerarlo)
  if (notesTags.includes("ácido") || notesTags.includes("sub-extraído")) {
    suggestions.push("🔧 Sub-extracción detectada: cerrar molienda y/o aumentar tiempo/temperatura");
  }

  if (notesTags.includes("amargo") || notesTags.includes("sobre-extraído") || notesTags.includes("astringente")) {
    suggestions.push("🔧 Sobre-extracción detectada: abrir molienda y/o reducir temperatura (-1-2°C)");
  }

  // Warning por cambio brusco
  if (Math.abs(grindDelta) > maxGrindDelta) {
    suggestions.push(
      `⚡ Cambio de molienda muy brusco (${Math.abs(grindDelta).toFixed(1)} puntos). Considere ajustes más graduales.`
    );
  }

  // Si todo está bien
  if (suggestions.length === 0) {
    return "✅ Parámetros dentro del rango objetivo. Listo para aprobar.";
  }

  return suggestions.join(" • ");
}

/**
 * Formatea el delta de molienda para mostrar
 */
export function formatGrindDelta(currentPoints: number, previousPoints?: number): string {
  if (previousPoints === undefined) return "";

  const delta = currentPoints - previousPoints;
  if (delta === 0) return "Sin cambio";

  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)} puntos`;
}

/**
 * Calcula el delta de clicks basado en clicks_per_point
 */
export function calculateClicksDelta(
  currentPoints: number,
  previousPoints: number | undefined,
  clicksPerPoint: number = 1
): number {
  if (previousPoints === undefined) return 0;
  return Math.round((currentPoints - previousPoints) * clicksPerPoint);
}
