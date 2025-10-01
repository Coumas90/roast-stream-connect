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
import { useDebounce } from "@/hooks/useDebounce";
import { useCoffeeProfiles } from "@/hooks/useCoffeeProfiles";
import { useCalibrationEntries, useCreateCalibrationEntry, useUpdateCalibrationEntry, useApproveCalibrationEntry, useTodayApprovedEntry } from "@/hooks/useCalibrationEntries";
import { useCalibrationSettings } from "@/hooks/useCalibrationSettings";
import { useProfile } from "@/hooks/useProfile";
import {
  calculateRatio,
  validateCalibration,
  evaluateSemaphore,
  generateSuggestions,
  formatGrindDelta,
  calculateClicksDelta,
} from "@/lib/calibration-utils";

interface CalibrationCalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId?: string;
}

type YieldUnit = "g" | "ml";
type Turno = "mañana" | "tarde" | "noche";

export function CalibrationCalculator({ open, onOpenChange, locationId }: CalibrationCalculatorProps) {
  const { profile } = useProfile();
  const { data: coffeeProfiles = [] } = useCoffeeProfiles(locationId);
  const { data: settings } = useCalibrationSettings();

  // Form state
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [turno, setTurno] = useState<Turno>("mañana");
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

  // Calculate ratio with density conversion (debounced)
  const ratio = useMemo(() => {
    const density = settings?.density_conversion || 0.98;
    return calculateRatio(debouncedYieldValue, yieldUnit, debouncedDoseG, density);
  }, [debouncedDoseG, debouncedYieldValue, yieldUnit, settings]);

  // Validations
  const validation = useMemo(() => {
    const maxGrindDelta = settings?.max_grind_delta || 1.5;
    const grindDelta = previousGrindPoints !== undefined ? debouncedGrindPoints - previousGrindPoints : 0;
    return validateCalibration(debouncedDoseG, debouncedYieldValue, debouncedTimeS, grindDelta, maxGrindDelta);
  }, [debouncedDoseG, debouncedYieldValue, debouncedTimeS, debouncedGrindPoints, previousGrindPoints, settings]);

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

    const { target_time_min, target_time_max, target_ratio_min, target_ratio_max } = selectedProfile;

    // Evaluate semaphore
    const semaphore = evaluateSemaphore({
      timeS: debouncedTimeS,
      ratio,
      targetTimeMin: target_time_min,
      targetTimeMax: target_time_max,
      targetRatioMin: target_ratio_min,
      targetRatioMax: target_ratio_max,
    });

    // Generate intelligent suggestions
    const grindDelta = previousGrindPoints !== undefined ? debouncedGrindPoints - previousGrindPoints : 0;
    const suggestionText = generateSuggestions({
      timeS: debouncedTimeS,
      ratio,
      targetTimeMin: target_time_min,
      targetTimeMax: target_time_max,
      targetRatioMin: target_ratio_min,
      targetRatioMax: target_ratio_max,
      notesTags,
      grindDelta,
      maxGrindDelta: settings?.max_grind_delta || 1.5,
    });

    return { ...semaphore, suggestion: suggestionText };
  }, [selectedProfile, debouncedTimeS, ratio, notesTags, debouncedGrindPoints, previousGrindPoints, settings]);

  // Calculate grind delta display
  const grindDeltaDisplay = useMemo(() => {
    return formatGrindDelta(grindPoints, previousGrindPoints);
  }, [grindPoints, previousGrindPoints]);

  const clicksDelta = useMemo(() => {
    const grinder = selectedProfile?.grinders;
    const clicksPerPoint = grinder && typeof grinder === 'object' && 'clicks_per_point' in grinder 
      ? (grinder as any).clicks_per_point 
      : 1;
    return calculateClicksDelta(grindPoints, previousGrindPoints, clicksPerPoint);
  }, [grindPoints, previousGrindPoints, selectedProfile]);

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

  const handleSave = async () => {
    if (!selectedProfileId || !profile?.id) return;

    // Validate before saving
    if (!validation.isValid) {
      return;
    }

    const entryData = {
      coffee_profile_id: selectedProfileId,
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
          <DialogTitle className="text-2xl">Calculadora de Calibración</DialogTitle>
          
          {/* Metadata Row */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Café</Label>
              <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar café" />
                </SelectTrigger>
                <SelectContent>
                  {coffeeProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name} {profile.lote && `- ${profile.lote}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
          {/* Validation Errors */}
          {validation.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc pl-4 space-y-1">
                  {validation.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Validation Warnings */}
          {validation.warnings.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc pl-4 space-y-1">
                  {validation.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {/* Steppers Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <Stepper
              label="Dosis"
              value={doseG}
              onChange={setDoseG}
              step={settings?.default_steps.dose_g || 0.1}
              unit="g"
              size="large"
            />

            <div className="space-y-2">
              <Label className="text-sm font-medium">Rendimiento</Label>
              <div className="flex items-center gap-2">
                <Stepper
                  label=""
                  value={yieldValue}
                  onChange={setYieldValue}
                  step={1}
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
              onChange={setTimeS}
              step={settings?.default_steps.time_s || 1}
              unit="s"
              size="large"
            />

            <Stepper
              label="Temperatura"
              value={tempC}
              onChange={setTempC}
              step={settings?.default_steps.temp_c || 1}
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
        <div className="sticky bottom-0 bg-background border-t p-6 flex gap-3">
          <Button onClick={handleSave} disabled={!selectedProfileId || !validation.isValid}>
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
            disabled={!selectedProfileId || !validation.isValid || overallStatus === "error"}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Aprobar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
