import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Coffee, Clock, Thermometer, Gauge, StickyNote, History, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TouchStepper } from "./wizard/components/TouchStepper";
import { CalibrationHistoryPanel } from "./CalibrationHistoryPanel";
import { useActiveRecipes } from "@/hooks/useActiveRecipes";
import { useGrinders } from "@/hooks/useGrinders";
import { useCalibrationSettings } from "@/hooks/useCalibrationSettings";
import { useTodayApprovedEntry, useTodayCalibrations, useCreateCalibrationEntry } from "@/hooks/useCalibrationEntries";
import { useProfile } from "@/hooks/useProfile";
import { useDebounce } from "@/hooks/useDebounce";
import { calculateRatio, evaluateSemaphore } from "@/lib/calibration-utils";
import { useToast } from "@/hooks/use-toast";
import { useCalibrationValidation, detectDrasticChanges } from "@/hooks/useCalibrationValidation";
import { useCalibrationApproval } from "@/hooks/useCalibrationApproval";
import { ShiftValidator } from "./ShiftValidator";
import { CalibrationConfirmModal } from "./CalibrationConfirmModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Info } from "lucide-react";

interface CalibrationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId?: string;
}

type YieldUnit = "g" | "ml";
type Turno = "mañana" | "tarde" | "noche";

export function CalibrationPanel({ open, onOpenChange, locationId: propLocationId }: CalibrationPanelProps) {
  const { profile } = useProfile();
  const { toast } = useToast();
  
  const locationId = propLocationId;
  
  // Data fetching
  const { data: activeRecipes = [], isLoading: recipesLoading } = useActiveRecipes(locationId);
  const { data: grinders = [] } = useGrinders(locationId);
  const { data: settings } = useCalibrationSettings();

  // State
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [turno, setTurno] = useState<Turno>("mañana");
  const [doseG, setDoseG] = useState(18);
  const [yieldValue, setYieldValue] = useState(36);
  const [yieldUnit, setYieldUnit] = useState<YieldUnit>("g");
  const [timeS, setTimeS] = useState(28);
  const [tempC, setTempC] = useState(93);
  const [grindPoints, setGrindPoints] = useState(3.5);
  const [notesTags, setNotesTags] = useState<string[]>([]);
  const [notesText, setNotesText] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Mutations
  const createEntry = useCreateCalibrationEntry();
  const { handleApproval, isApproving, approvalStep } = useCalibrationApproval();

  // Get calibrations for today
  const { data: approvedEntry } = useTodayApprovedEntry(undefined, selectedRecipeId, turno);
  const { data: todayCalibrations = [] } = useTodayCalibrations(undefined, selectedRecipeId, turno);

  // Debounced values
  const debouncedDoseG = useDebounce(doseG, 200);
  const debouncedYieldValue = useDebounce(yieldValue, 200);
  const debouncedTimeS = useDebounce(timeS, 200);

  // Auto-select current shift
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) setTurno("mañana");
    else if (hour >= 14 && hour < 20) setTurno("tarde");
    else setTurno("noche");
  }, []);

  // Auto-select first recipe
  useEffect(() => {
    if (activeRecipes.length > 0 && !selectedRecipeId) {
      setSelectedRecipeId(activeRecipes[0].id);
    }
  }, [activeRecipes, selectedRecipeId]);

  const selectedRecipe = useMemo(
    () => activeRecipes.find((r) => r.id === selectedRecipeId),
    [activeRecipes, selectedRecipeId]
  );

  // Calculate ratio
  const ratio = useMemo(() => {
    const density = settings?.density_conversion || 0.98;
    return calculateRatio(debouncedYieldValue, yieldUnit, debouncedDoseG, density);
  }, [debouncedDoseG, debouncedYieldValue, yieldUnit, settings]);

  // Semaphore status
  const semaphore = useMemo(() => {
    if (!selectedRecipe) return null;
    return evaluateSemaphore({
      timeS: debouncedTimeS,
      ratio,
      targetTimeMin: selectedRecipe.target_time_min,
      targetTimeMax: selectedRecipe.target_time_max,
      targetRatioMin: selectedRecipe.target_ratio_min,
      targetRatioMax: selectedRecipe.target_ratio_max,
    });
  }, [selectedRecipe, debouncedTimeS, ratio]);

  const quickNotes = settings?.quick_notes_chips || [
    "equilibrado",
    "ácido",
    "amargo",
    "dulce",
    "sub-extraído",
    "sobre-extraído",
  ];

  const handleApprove = async () => {
    if (!selectedRecipeId || !profile?.id) {
      toast({
        title: "Error",
        description: "Debes seleccionar una receta y un turno",
        variant: "destructive",
      });
      return;
    }

    // Show confirmation modal for replacements or drastic changes
    if (approvedEntry || drasticChanges.length > 0) {
      setShowConfirmModal(true);
      return;
    }

    // Direct approval if no confirmation needed
    await executeApproval();
  };

  const executeApproval = async () => {
    if (!profile?.id) return;

    const previousGrindPoints = approvedEntry?.grind_points;
    const clicksDelta = previousGrindPoints !== undefined 
      ? Math.round((grindPoints - previousGrindPoints) * 1)
      : 0;

    const entryData = {
      recipe_id: selectedRecipeId,
      coffee_profile_id: null,
      barista_id: profile.id,
      turno,
      dose_g: doseG,
      yield_value: yieldValue,
      yield_unit: yieldUnit,
      time_s: timeS,
      temp_c: tempC,
      grind_points: grindPoints,
      grind_label: null,
      grinder_clicks_delta: clicksDelta,
      notes_tags: notesTags,
      notes_text: notesText || null,
      suggestion_shown: "",
    };

    try {
      await handleApproval({
        entryData,
        existingApprovedId: approvedEntry?.id,
        onSuccess: () => {
          onOpenChange(false);
          setShowConfirmModal(false);
        },
      });
    } catch (error) {
      setShowConfirmModal(false);
    }
  };

  const getSemaphoreColor = () => {
    if (!semaphore) return "bg-muted";
    switch (semaphore.overallStatus) {
      case "good":
        return "bg-green-500";
      case "warning":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-muted";
    }
  };

  const getSemaphoreEmoji = () => {
    if (!semaphore) return "😐";
    switch (semaphore.overallStatus) {
      case "good":
        return "😊";
      case "warning":
        return "😐";
      case "error":
        return "😟";
      default:
        return "😐";
    }
  };

  // Validation using the custom hook
  const validation = useCalibrationValidation({
    doseG,
    yieldValue,
    timeS,
    turno,
    selectedRecipeId,
    semaphoreStatus: semaphore?.overallStatus,
  });

  // Detect drastic changes from previous calibration
  const drasticChanges = useMemo(() => {
    if (!approvedEntry) return [];
    return detectDrasticChanges(
      { doseG, yieldValue, timeS, tempC },
      approvedEntry
    );
  }, [approvedEntry, doseG, yieldValue, timeS, tempC]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] p-0 gap-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 h-full">
          {/* LEFT: Coffee Selection & Status */}
          <div className="lg:col-span-1 p-6 border-r bg-muted/20 space-y-4 overflow-y-auto max-h-[95vh]">
            {/* Header */}
            <div>
              <h2 className="text-xl font-bold">Calibración Diaria</h2>
              <p className="text-sm text-muted-foreground">Selecciona el café y turno</p>
            </div>

            {/* Validation Errors */}
            {validation.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {validation.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Validation Warnings */}
            {validation.warnings.length > 0 && (
              <Alert variant="default" className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {validation.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Drastic Changes Warning */}
            {drasticChanges.length > 0 && (
              <Alert variant="default" className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  <p className="font-semibold mb-1 text-sm">Cambios significativos:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    {drasticChanges.map((change, idx) => (
                      <li key={idx}>{change}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            {/* Shift Selection */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Turno</label>
              <div className="grid grid-cols-3 gap-2">
                {(["mañana", "tarde", "noche"] as const).map((shift) => (
                  <Button
                    key={shift}
                    variant={turno === shift ? "default" : "outline"}
                    size="sm"
                    className="capitalize"
                    onClick={() => setTurno(shift)}
                    disabled={isApproving || createEntry.isPending}
                  >
                    {shift}
                  </Button>
                ))}
              </div>
              <ShiftValidator turno={turno} />
            </div>

            {/* Recipe Cards */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Receta Madre</label>
              <div className="space-y-2">
                {recipesLoading ? (
                  <Card className="p-4 text-center text-sm text-muted-foreground">
                    Cargando recetas...
                  </Card>
                ) : activeRecipes.length === 0 ? (
                  <Card className="p-4 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      No hay recetas activas configuradas
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Contacta al administrador para activar recetas de espresso
                    </p>
                  </Card>
                ) : (
                  activeRecipes.map((recipe) => (
                    <Card
                      key={recipe.id}
                      className={cn(
                        "p-4 cursor-pointer transition-all hover-scale",
                        selectedRecipeId === recipe.id
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/50"
                      )}
                      onClick={() => {
                        if (!isApproving && !createEntry.isPending) {
                          setSelectedRecipeId(recipe.id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Coffee className="w-5 h-5 text-primary" />
                        <div className="flex-1">
                          <div className="font-semibold">{recipe.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {recipe.coffee_name}
                          </div>
                          {recipe.coffee_origin && (
                            <div className="text-xs text-muted-foreground/70">
                              {recipe.coffee_origin}
                            </div>
                          )}
                        </div>
                        {selectedRecipeId === recipe.id && (
                          <CheckCircle className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Approved Entry Badge with Adjust Button */}
            {approvedEntry && (
              <Card className="p-3 bg-green-50 dark:bg-green-950/20 border-green-500">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">Calibración aprobada</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDoseG(approvedEntry.dose_g);
                      setYieldValue(approvedEntry.yield_value);
                      setYieldUnit(approvedEntry.yield_unit as YieldUnit);
                      setTimeS(approvedEntry.time_s);
                      setTempC(approvedEntry.temp_c);
                      setGrindPoints(approvedEntry.grind_points);
                      setNotesTags(approvedEntry.notes_tags || []);
                      setNotesText(approvedEntry.notes_text || "");
                    }}
                    disabled={isApproving || createEntry.isPending}
                  >
                    Ajustar y Reemplazar
                  </Button>
                </div>
              </Card>
            )}

            <Separator />

            {/* Semaphore Status */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Estado</label>
              <Card className="p-3 text-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-2xl shadow-md",
                    getSemaphoreColor()
                  )}
                >
                  {getSemaphoreEmoji()}
                </div>
                <div className="text-sm font-medium capitalize">
                  {semaphore?.overallStatus === "good" && "Excelente"}
                  {semaphore?.overallStatus === "warning" && "Aceptable"}
                  {semaphore?.overallStatus === "error" && "Necesita ajustes"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Ratio: {ratio.toFixed(2)} | Tiempo: {timeS}s
                </div>
              </Card>
            </div>

            {/* History Section */}
            {todayCalibrations.length > 0 && (
              <>
                <Separator />
                <CalibrationHistoryPanel
                  entries={todayCalibrations}
                  approvedEntryId={approvedEntry?.id}
                />
              </>
            )}
          </div>

          {/* CENTER & RIGHT: Parameters */}
          <div className="lg:col-span-2 p-6 overflow-y-auto space-y-6">
            {/* Parameters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Dose */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Coffee className="w-4 h-4 text-primary" />
                  <label className="text-sm font-semibold">Dosis</label>
                </div>
                <TouchStepper
                  value={doseG}
                  onChange={setDoseG}
                  step={settings?.default_steps.dose_g || 0.1}
                  min={10}
                  max={30}
                  unit="g"
                  size="large"
                />
              </Card>

              {/* Yield */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Coffee className="w-4 h-4 text-primary" />
                  <label className="text-sm font-semibold">Rendimiento</label>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <TouchStepper
                      value={yieldValue}
                      onChange={setYieldValue}
                      step={1}
                      min={20}
                      max={80}
                      unit={yieldUnit}
                      size="large"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-14 w-14"
                    onClick={() => setYieldUnit(yieldUnit === "g" ? "ml" : "g")}
                  >
                    {yieldUnit}
                  </Button>
                </div>
              </Card>

              {/* Time */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-primary" />
                  <label className="text-sm font-semibold">Tiempo</label>
                </div>
                <TouchStepper
                  value={timeS}
                  onChange={setTimeS}
                  step={settings?.default_steps.time_s || 0.5}
                  min={15}
                  max={60}
                  unit="s"
                  size="large"
                />
              </Card>

              {/* Temperature */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Thermometer className="w-4 h-4 text-primary" />
                  <label className="text-sm font-semibold">Temperatura</label>
                </div>
                <TouchStepper
                  value={tempC}
                  onChange={setTempC}
                  step={settings?.default_steps.temp_c || 0.5}
                  min={85}
                  max={98}
                  unit="°C"
                  size="large"
                />
              </Card>

              {/* Grind */}
              <Card className="p-4 md:col-span-2">
                <div className="flex items-center gap-2 mb-3">
                  <Gauge className="w-4 h-4 text-primary" />
                  <label className="text-sm font-semibold">Molienda</label>
                </div>
                <TouchStepper
                  value={grindPoints}
                  onChange={setGrindPoints}
                  step={settings?.default_steps.grind_points || 0.1}
                  min={0}
                  max={10}
                  size="large"
                />
              </Card>
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-primary" />
                <label className="text-sm font-semibold">Notas de Cata</label>
              </div>
              <div className="flex flex-wrap gap-2">
                {quickNotes.map((note) => (
                  <Badge
                    key={note}
                    variant={notesTags.includes(note) ? "default" : "outline"}
                    className="cursor-pointer touch-manipulation hover-scale"
                    onClick={() =>
                      setNotesTags((prev) =>
                        prev.includes(note)
                          ? prev.filter((t) => t !== note)
                          : [...prev, note]
                      )
                    }
                  >
                    {note}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={async () => {
                  if (!selectedRecipeId || !profile?.id) return;

                  const previousGrindPoints = approvedEntry?.grind_points;
                  const clicksDelta = previousGrindPoints !== undefined 
                    ? Math.round((grindPoints - previousGrindPoints) * 1)
                    : 0;

                  const entryData = {
                    recipe_id: selectedRecipeId,
                    coffee_profile_id: null,
                    barista_id: profile.id,
                    turno,
                    dose_g: doseG,
                    yield_value: yieldValue,
                    yield_unit: yieldUnit,
                    time_s: timeS,
                    temp_c: tempC,
                    grind_points: grindPoints,
                    grind_label: null,
                    grinder_clicks_delta: clicksDelta,
                    notes_tags: notesTags,
                    notes_text: notesText || null,
                    suggestion_shown: "",
                  };

                  try {
                    await createEntry.mutateAsync(entryData);
                    toast({
                      title: "Borrador guardado",
                      description: "Calibración guardada sin aprobar",
                    });
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "No se pudo guardar",
                      variant: "destructive",
                    });
                  }
                }}
                disabled={!selectedRecipeId || createEntry.isPending}
                className="h-14 text-base font-semibold"
                size="lg"
              >
                Guardar Borrador
              </Button>
              
              <Button
                onClick={handleApprove}
                disabled={!validation.isValid || !selectedRecipeId || createEntry.isPending || isApproving}
                className="h-14 text-base font-semibold"
                size="lg"
              >
                {createEntry.isPending ? (
                  "Guardando..."
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Aprobar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Confirmation Modal */}
        <CalibrationConfirmModal
          open={showConfirmModal}
          onOpenChange={setShowConfirmModal}
          onConfirm={executeApproval}
          currentParams={{ doseG, yieldValue, timeS, tempC, grindPoints }}
          previousParams={approvedEntry}
          drasticChanges={drasticChanges}
          isReplacement={!!approvedEntry}
        />
      </DialogContent>
    </Dialog>
  );
}
