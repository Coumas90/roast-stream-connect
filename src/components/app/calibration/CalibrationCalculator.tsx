import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, Copy, RotateCcw, CheckCircle, Plus, Minus, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { OfflineSyncStatus } from "./OfflineSyncStatus";
import { CalibrationGuide } from "./CalibrationGuide";
import { useDebounce } from "@/hooks/useDebounce";
import { useCoffeeProfiles } from "@/hooks/useCoffeeProfiles";
import { useLocationStock } from "@/hooks/useLocationStock";
import { useCalibrationEntries, useCreateCalibrationEntry, useUpdateCalibrationEntry, useApproveCalibrationEntry, useTodayApprovedEntry } from "@/hooks/useCalibrationEntries";
import { useCalibrationSettings } from "@/hooks/useCalibrationSettings";
import { useProfile } from "@/hooks/useProfile";
import { useOfflineCalibration } from "@/hooks/useOfflineCalibration";
import { useCalibrationValidation } from "@/hooks/useCalibrationValidation";
import {
  calculateRatio,
  evaluateSemaphore,
  generateSuggestions,
  formatGrindDelta,
  calculateClicksDelta,
} from "@/lib/calibration-utils";
import { ShiftValidator } from "./ShiftValidator";
import confetti from "canvas-confetti";

interface CalibrationCalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId?: string;
}

type YieldUnit = "g" | "ml";
type Turno = "mañana" | "tarde" | "noche";

export function CalibrationCalculator({ open, onOpenChange, locationId }: CalibrationCalculatorProps) {
  const { profile } = useProfile();
  
  // Protection against undefined locationId
  if (!locationId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error de Configuración</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No se pudo cargar la ubicación. Por favor, selecciona una ubicación válida desde el menú principal.
            </AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    );
  }
  
  const { data: coffeeProfiles = [] } = useCoffeeProfiles(locationId);
  const { data: hoppers = [] } = useLocationStock(locationId);
  const { data: settings } = useCalibrationSettings();
  const { isOnline, saveDraft, loadLatestDraft, enableAutoSave, cacheProfile } = useOfflineCalibration();

  // Find active coffee profile for this location
  const activeCoffeeProfile = useMemo(() => 
    coffeeProfiles.find(p => p.active === true),
    [coffeeProfiles]
  );
  
  // Warn if multiple active profiles detected
  useEffect(() => {
    const activeProfiles = coffeeProfiles.filter(p => p.active === true);
    if (activeProfiles.length > 1) {
      console.warn(`⚠️ Múltiples perfiles activos detectados (${activeProfiles.length}). Se usará el primero.`);
    }
  }, [coffeeProfiles]);

  // Telemetry session tracking
  const [sessionRef] = useState(() => {
    // Import CalibrationSession dynamically to avoid circular deps
    return { current: null as any };
  });

  // Form state - auto-select active coffee profile
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [selectedHopperId, setSelectedHopperId] = useState<string | null>(null);
  
  // Auto-detect shift based on current time
  const [turno, setTurno] = useState<Turno>(() => {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour >= 6 && hour < 14) return "mañana";
    if (hour >= 14 && hour < 22) return "tarde";
    return "noche";
  });
  const [doseG, setDoseG] = useState(18);
  const [yieldValue, setYieldValue] = useState(36);
  const [yieldUnit, setYieldUnit] = useState<YieldUnit>("g");
  const [timeS, setTimeS] = useState(28);
  const [tempC, setTempC] = useState(93);
  const [grindPoints, setGrindPoints] = useState(3.5);
  const [grindLabel, setGrindLabel] = useState("");
  const [notesTags, setNotesTags] = useState<string[]>([]);
  const [notesText, setNotesText] = useState("");
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [previousGrindPoints, setPreviousGrindPoints] = useState<number | undefined>(undefined);

  // Debounced values for calculations (200ms)
  const debouncedDoseG = useDebounce(doseG, 200);
  const debouncedYieldValue = useDebounce(yieldValue, 200);
  const debouncedTimeS = useDebounce(timeS, 200);
  const debouncedTempC = useDebounce(tempC, 200);
  const debouncedGrindPoints = useDebounce(grindPoints, 200);

  const selectedProfile = useMemo(
    () => coffeeProfiles.find((p) => p.id === selectedProfileId),
    [coffeeProfiles, selectedProfileId]
  );

  const { data: approvedEntry } = useTodayApprovedEntry(selectedProfileId, turno);

  const createEntry = useCreateCalibrationEntry();
  const updateEntry = useUpdateCalibrationEntry();
  const approveEntry = useApproveCalibrationEntry();

  // Load previous grind points from approved entry
  useEffect(() => {
    if (approvedEntry) {
      setPreviousGrindPoints(approvedEntry.grind_points);
    }
  }, [approvedEntry]);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!open || !selectedProfileId) return;

    const draftId = `calibration-${selectedProfileId}-${turno}`;
    const getData = () => ({
      selectedProfileId,
      selectedHopperId,
      turno,
      doseG,
      yieldValue,
      yieldUnit,
      timeS,
      tempC,
      grindPoints,
      grindLabel,
      notesTags,
      notesText,
    });

    const cleanup = enableAutoSave(draftId, getData, 30000);
    return cleanup;
  }, [open, selectedProfileId, selectedHopperId, turno, doseG, yieldValue, yieldUnit, timeS, tempC, grindPoints, grindLabel, notesTags, notesText, enableAutoSave]);

  // Load draft on open OR auto-select active coffee profile
  useEffect(() => {
    if (open) {
      loadLatestDraft().then((draft) => {
        if (draft && draft.data) {
          const data = draft.data;
          setSelectedProfileId(data.selectedProfileId || data.selectedRecipeId || "");
          setSelectedHopperId(data.selectedHopperId || null);
          setTurno(data.turno || turno);
          setDoseG(data.doseG || 18);
          setYieldValue(data.yieldValue || 36);
          setYieldUnit(data.yieldUnit || "g");
          setTimeS(data.timeS || 28);
          setTempC(data.tempC || 93);
          setGrindPoints(data.grindPoints || 3.5);
          setGrindLabel(data.grindLabel || "");
          setNotesTags(data.notesTags || []);
          setNotesText(data.notesText || "");
        } else if (activeCoffeeProfile && !selectedProfileId) {
          // Pre-select active coffee profile if no draft exists
          setSelectedProfileId(activeCoffeeProfile.id);
          
          // Pre-fill parameters from coffee profile with sanitization
          const targetDose = Math.max(1, Math.min(30, activeCoffeeProfile.target_dose_g || 18));
          const targetYield = Math.max(1, Math.min(100, 
            activeCoffeeProfile.target_ratio_min ? targetDose * activeCoffeeProfile.target_ratio_min : 36
          ));
          const targetTemp = Math.max(80, Math.min(100, activeCoffeeProfile.target_temp_c || 93));
          
          setDoseG(targetDose);
          setYieldValue(targetYield);
          setTempC(targetTemp);
          
          // Pre-select first hopper if available
          if (hoppers.length > 0) {
            setSelectedHopperId(hoppers[0].id);
          }
        }
      });
    }
  }, [open, loadLatestDraft, activeCoffeeProfile, selectedProfileId, turno, hoppers]);

  // Cache active coffee profile
  useEffect(() => {
    if (selectedProfile) {
      cacheProfile(selectedProfile.id, selectedProfile);
    }
  }, [selectedProfile, cacheProfile]);

  // Calculate ratio with density conversion (debounced)
  const ratio = useMemo(() => {
    const density = settings?.density_conversion || 0.98;
    return calculateRatio(debouncedYieldValue, yieldUnit, debouncedDoseG, density);
  }, [debouncedDoseG, debouncedYieldValue, yieldUnit, settings]);

  // Semaphore status and suggestions (debounced)
  const { timeStatus, ratioStatus, overallStatus, suggestion } = useMemo(() => {
    if (!selectedProfile) {
      return { 
        timeStatus: "good" as const, 
        ratioStatus: "good" as const, 
        overallStatus: "good" as const, 
        suggestion: "" 
      };
    }

    // Extract parameters from coffee profile
    const targetTimeMin = selectedProfile.target_time_min || 25;
    const targetTimeMax = selectedProfile.target_time_max || 32;
    const targetRatioMin = selectedProfile.target_ratio_min || 1.8;
    const targetRatioMax = selectedProfile.target_ratio_max || 2.2;

    // Evaluate semaphore
    const semaphore = evaluateSemaphore({
      timeS: debouncedTimeS,
      ratio,
      targetTimeMin,
      targetTimeMax,
      targetRatioMin,
      targetRatioMax,
    });

    // Generate intelligent suggestions
    const grindDelta = previousGrindPoints !== undefined ? debouncedGrindPoints - previousGrindPoints : 0;
    const suggestionText = generateSuggestions({
      timeS: debouncedTimeS,
      ratio,
      targetTimeMin,
      targetTimeMax,
      targetRatioMin,
      targetRatioMax,
      notesTags,
      grindDelta,
      maxGrindDelta: settings?.max_grind_delta || 1.5,
    });

    return { ...semaphore, suggestion: suggestionText };
  }, [selectedProfile, debouncedTimeS, ratio, notesTags, debouncedGrindPoints, previousGrindPoints, settings]);

  // Use proper validation hook after semaphore calculation
  const validation = useCalibrationValidation({
    doseG: debouncedDoseG,
    yieldValue: debouncedYieldValue,
    timeS: debouncedTimeS,
    turno,
    selectedRecipeId: selectedProfileId,
    semaphoreStatus: overallStatus
  });

  // Calculate grind delta display
  const grindDeltaDisplay = useMemo(() => {
    return formatGrindDelta(grindPoints, previousGrindPoints);
  }, [grindPoints, previousGrindPoints]);

  const clicksDelta = useMemo(() => {
    // Default clicks per point to 1 for recipes (can be enhanced later)
    const clicksPerPoint = 1;
    return calculateClicksDelta(grindPoints, previousGrindPoints, clicksPerPoint);
  }, [grindPoints, previousGrindPoints]);

  // Stepper component
  const Stepper = ({ 
    label, 
    value, 
    onChange, 
    step = 0.1, 
    min = 0, 
    unit = "",
    size = "default"
  }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    step?: number;
    min?: number;
    unit?: string;
    size?: "default" | "large";
  }) => {
    const buttonSize = size === "large" ? "h-14 w-14" : "h-10 w-10";
    const fontSize = size === "large" ? "text-2xl" : "text-lg";

    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(buttonSize, "touch-manipulation")}
            onClick={() => onChange(Math.max(min, value - step))}
          >
            <Minus className="h-5 w-5" />
          </Button>
          <div className={cn("flex-1 text-center font-bold", fontSize)}>
            {value.toFixed(step < 1 ? 1 : 0)}
            {unit && <span className="text-muted-foreground ml-1">{unit}</span>}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(buttonSize, "touch-manipulation")}
            onClick={() => onChange(value + step)}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  };

  // Confetti animation for perfect calibration
  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#3b82f6', '#8b5cf6'],
    });
  };

  const handleSave = async () => {
    if (!selectedProfileId || !profile?.id) return;

    // Validate before saving
    if (!validation.isValid) {
      return;
    }

    const entryData: any = {
      coffee_profile_id: selectedProfileId,
      recipe_id: selectedProfile?.recipe_id || null,
      hopper_id: selectedHopperId || null,
      barista_id: profile.id,
      turno,
      dose_g: doseG,
      yield_value: yieldValue,
      yield_unit: yieldUnit,
      time_s: timeS,
      temp_c: tempC,
      grind_points: grindPoints,
      grind_label: grindLabel || null,
      grinder_clicks_delta: clicksDelta,
      notes_tags: notesTags,
      notes_text: notesText || null,
      suggestion_shown: suggestion,
    };

    if (currentEntryId) {
      await updateEntry.mutateAsync({ id: currentEntryId, updates: entryData });
    } else {
      const result = await createEntry.mutateAsync(entryData);
      setCurrentEntryId(result.id);
      // Update previous grind points after saving
      setPreviousGrindPoints(grindPoints);
    }
  };

  const handleDuplicate = () => {
    setCurrentEntryId(null);
    // Keep current values but reset entry ID to create a new one
  };

  const handleRevert = () => {
    if (approvedEntry) {
      setDoseG(approvedEntry.dose_g);
      setYieldValue(approvedEntry.yield_value);
      setYieldUnit(approvedEntry.yield_unit as YieldUnit);
      setTimeS(approvedEntry.time_s);
      setTempC(approvedEntry.temp_c);
      setGrindPoints(approvedEntry.grind_points);
      setGrindLabel(approvedEntry.grind_label || "");
      setNotesTags(approvedEntry.notes_tags);
      setNotesText(approvedEntry.notes_text || "");
    }
  };

  const handleApprove = async () => {
    // Validate before approving
    if (!validation.isValid) {
      return;
    }

    if (!currentEntryId) {
      await handleSave();
    }
    if (currentEntryId) {
      await approveEntry.mutateAsync(currentEntryId);
      
      // Trigger confetti if calibration is perfect (green status)
      if (overallStatus === "good") {
        triggerConfetti();
      }
    }
  };

  const toggleNoteTag = (tag: string) => {
    setNotesTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const quickNotes = settings?.quick_notes_chips || [
    "ácido",
    "amargo",
    "equilibrado",
    "dulce",
    "astringente",
    "sub-extraído",
    "sobre-extraído",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] overflow-y-auto p-0">
        {/* Fixed Header */}
        <DialogHeader className="sticky top-0 z-10 bg-background border-b p-6">
          <div className="flex items-center justify-between mb-4">
            <DialogTitle className="text-2xl">Calculadora de Calibración</DialogTitle>
            <OfflineSyncStatus />
          </div>
          
          {/* Metadata Row */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Perfil de café</Label>
              <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar perfil" />
                </SelectTrigger>
                <SelectContent>
                  {coffeeProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validation.errors.find(e => e.includes('receta')) && (
                <p className="text-sm text-destructive">⚠️ Debes seleccionar un perfil para continuar</p>
              )}
              {activeCoffeeProfile && selectedProfileId === activeCoffeeProfile.id && (
                <p className="text-xs text-muted-foreground">✓ Perfil activo seleccionado</p>
              )}
            </div>
            
            {/* Hopper Selector */}
            {hoppers.length > 0 && (
              <div className="space-y-2">
                <Label>Hopper</Label>
                <Select value={selectedHopperId || undefined} onValueChange={setSelectedHopperId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona hopper" />
                  </SelectTrigger>
                  <SelectContent>
                    {hoppers.map((hopper) => (
                      <SelectItem key={hopper.id} value={hopper.id}>
                        <div className="flex flex-col">
                          <span>Hopper {hopper.hopper_number}</span>
                          <span className="text-xs text-muted-foreground">
                            {hopper.coffee_varieties?.name} ({hopper.current_kg}kg)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Turno</Label>
              <Select value={turno} onValueChange={(v) => setTurno(v as Turno)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mañana">Mañana</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                  <SelectItem value="noche">Noche</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {approvedEntry && (
            <Badge variant="secondary" className="mt-2">
              ✓ Ya existe calibración aprobada para hoy
            </Badge>
          )}
        </DialogHeader>

        {/* Main Content */}
        <div className="p-6 space-y-6">
          {/* Validation Errors - Real-time */}
          {validation.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">Errores que debes corregir:</div>
                <ul className="list-disc pl-4 space-y-1">
                  {validation.errors.map((error, i) => (
                    <li key={i} className="text-sm">{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Validation Warnings - Real-time */}
          {validation.warnings.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">Advertencias:</div>
                <ul className="list-disc pl-4 space-y-1">
                  {validation.warnings.map((warning, i) => (
                    <li key={i} className="text-sm">{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Shift Validator */}
          <ShiftValidator turno={turno} />
          
          {/* Calibration Guide */}
          {selectedProfile && (
            <CalibrationGuide
              targetProfile={{
                target_dose_g: selectedProfile.target_dose_g || 18,
                target_time_min: selectedProfile.target_time_min || 25,
                target_time_max: selectedProfile.target_time_max || 32,
                target_ratio_min: selectedProfile.target_ratio_min || 1.8,
                target_ratio_max: selectedProfile.target_ratio_max || 2.2,
                target_temp_c: selectedProfile.target_temp_c || 93,
              } as any}
              currentValues={{
                dose_g: debouncedDoseG,
                ratio,
                time_s: debouncedTimeS,
                temp_c: tempC,
                grind_points: grindPoints,
              }}
              semaphoreStatus={overallStatus === 'good' ? 'success' : overallStatus === 'warning' ? 'warning' : 'error'}
            />
          )}
          
          {/* Steppers Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <Stepper
              label="Dosis"
              value={doseG}
              onChange={(val) => setDoseG(Math.max(1, Math.min(30, val)))}
              step={settings?.default_steps.dose_g || 0.1}
              min={1}
              unit="g"
              size="large"
            />

            <div className="space-y-2">
              <Label className="text-sm font-medium">Rendimiento</Label>
              <div className="flex items-center gap-2">
                <Stepper
                  label=""
                  value={yieldValue}
                  onChange={(val) => setYieldValue(Math.max(1, Math.min(100, val)))}
                  step={1}
                  min={1}
                  unit={yieldUnit}
                  size="large"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setYieldUnit(yieldUnit === "g" ? "ml" : "g")}
                  className="h-10"
                >
                  {yieldUnit}
                </Button>
              </div>
            </div>

            <Stepper
              label="Tiempo"
              value={timeS}
              onChange={(val) => setTimeS(Math.max(1, Math.min(120, val)))}
              step={settings?.default_steps.time_s || 1}
              min={1}
              unit="s"
              size="large"
            />

            <Stepper
              label="Temperatura"
              value={tempC}
              onChange={(val) => setTempC(Math.max(80, Math.min(100, val)))}
              step={settings?.default_steps.temp_c || 1}
              min={80}
              unit="°C"
              size="large"
            />

            <div className="space-y-2">
              <Stepper
                label="Molienda"
                value={grindPoints}
                onChange={setGrindPoints}
                step={settings?.default_steps.grind_points || 0.5}
                size="large"
              />
              {grindDeltaDisplay && (
                <div className="text-xs text-center text-muted-foreground">
                  {grindDeltaDisplay} {clicksDelta !== 0 && `(~${clicksDelta} clicks)`}
                </div>
              )}
            </div>
          </div>

          {/* Preview with Semaphore */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">Ratio:</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{ratio.toFixed(2)}</span>
                <div
                  className={cn(
                    "w-3 h-3 rounded-full",
                    ratioStatus === "good" && "bg-green-500",
                    ratioStatus === "warning" && "bg-yellow-500",
                    ratioStatus === "error" && "bg-red-500"
                  )}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-medium">Tiempo:</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{timeS}s</span>
                <div
                  className={cn(
                    "w-3 h-3 rounded-full",
                    timeStatus === "good" && "bg-green-500",
                    timeStatus === "warning" && "bg-yellow-500",
                    timeStatus === "error" && "bg-red-500"
                  )}
                />
              </div>
            </div>

            {suggestion && (
              <div
                className={cn(
                  "mt-3 p-3 rounded-md text-sm",
                  overallStatus === "good" && "bg-green-50 text-green-900",
                  overallStatus === "warning" && "bg-yellow-50 text-yellow-900",
                  overallStatus === "error" && "bg-red-50 text-red-900"
                )}
              >
                {suggestion}
              </div>
            )}
          </div>

          {/* Quick Notes Chips */}
          <div className="space-y-2">
            <Label>Notas rápidas</Label>
            <div className="flex flex-wrap gap-2">
              {quickNotes.map((note) => (
                <Badge
                  key={note}
                  variant={notesTags.includes(note) ? "default" : "outline"}
                  className="cursor-pointer touch-manipulation"
                  onClick={() => toggleNoteTag(note)}
                >
                  {note}
                </Badge>
              ))}
            </div>
          </div>

          {/* Textarea for additional notes */}
          <div className="space-y-2">
            <Label>Notas adicionales</Label>
            <Textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Observaciones adicionales..."
              rows={3}
            />
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="sticky bottom-0 bg-background border-t p-6 space-y-3">
          {/* Show specific reason why save is disabled */}
          {!validation.isValid && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">
                {validation.errors.length > 0 
                  ? `No se puede guardar: ${validation.errors[0]}` 
                  : 'Corrige los errores antes de guardar'}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex gap-3">
            <Button 
              onClick={handleSave} 
              disabled={!validation.isValid}
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
            Guardar
            </Button>
            <Button variant="outline" onClick={handleDuplicate} disabled={!currentEntryId}>
              <Copy className="w-4 h-4 mr-2" />
              Duplicar
            </Button>
            <Button variant="outline" onClick={handleRevert} disabled={!approvedEntry}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Revertir
            </Button>
            <Button 
              variant="default" 
              onClick={handleApprove} 
              disabled={!validation.isValid || overallStatus === "error"}
              className="flex-1"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Aprobar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
