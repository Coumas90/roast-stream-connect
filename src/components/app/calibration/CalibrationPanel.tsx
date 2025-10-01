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
import { useCoffeeProfiles } from "@/hooks/useCoffeeProfiles";
import { useGrinders } from "@/hooks/useGrinders";
import { useCalibrationSettings } from "@/hooks/useCalibrationSettings";
import { useTodayApprovedEntry, useTodayCalibrations, useCreateCalibrationEntry, useApproveCalibrationEntry } from "@/hooks/useCalibrationEntries";
import { useProfile } from "@/hooks/useProfile";
import { useDebounce } from "@/hooks/useDebounce";
import { calculateRatio, evaluateSemaphore } from "@/lib/calibration-utils";
import { useToast } from "@/hooks/use-toast";

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
  
  // Get locationId from user_roles if not provided
  const { data: userLocation } = useQuery({
    queryKey: ["user-location", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("location_id")
        .eq("user_id", profile.id)
        .not("location_id", "is", null)
        .limit(1)
        .single();
      
      if (error) {
        console.error("Error fetching user location:", error);
        return null;
      }
      
      return data?.location_id;
    },
    enabled: !!profile?.id && !propLocationId,
  });

  const locationId = propLocationId || userLocation;
  
  // Data fetching
  const { data: coffeeProfiles = [] } = useCoffeeProfiles(locationId);
  const { data: grinders = [] } = useGrinders(locationId);
  const { data: settings } = useCalibrationSettings();

  // State
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [turno, setTurno] = useState<Turno>("mañana");
  const [doseG, setDoseG] = useState(18);
  const [yieldValue, setYieldValue] = useState(36);
  const [yieldUnit, setYieldUnit] = useState<YieldUnit>("g");
  const [timeS, setTimeS] = useState(28);
  const [tempC, setTempC] = useState(93);
  const [grindPoints, setGrindPoints] = useState(3.5);
  const [notesTags, setNotesTags] = useState<string[]>([]);
  const [notesText, setNotesText] = useState("");

  // Mutations
  const createEntry = useCreateCalibrationEntry();
  const approveEntry = useApproveCalibrationEntry();

  // Get calibrations for today
  const { data: approvedEntry } = useTodayApprovedEntry(selectedProfileId, turno);
  const { data: todayCalibrations = [] } = useTodayCalibrations(selectedProfileId, turno);

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

  // Auto-select first profile
  useEffect(() => {
    if (coffeeProfiles.length > 0 && !selectedProfileId) {
      setSelectedProfileId(coffeeProfiles[0].id);
    }
  }, [coffeeProfiles, selectedProfileId]);

  const selectedProfile = useMemo(
    () => coffeeProfiles.find((p) => p.id === selectedProfileId),
    [coffeeProfiles, selectedProfileId]
  );

  // Calculate ratio
  const ratio = useMemo(() => {
    const density = settings?.density_conversion || 0.98;
    return calculateRatio(debouncedYieldValue, yieldUnit, debouncedDoseG, density);
  }, [debouncedDoseG, debouncedYieldValue, yieldUnit, settings]);

  // Semaphore status
  const semaphore = useMemo(() => {
    if (!selectedProfile) return null;
    return evaluateSemaphore({
      timeS: debouncedTimeS,
      ratio,
      targetTimeMin: selectedProfile.target_time_min,
      targetTimeMax: selectedProfile.target_time_max,
      targetRatioMin: selectedProfile.target_ratio_min,
      targetRatioMax: selectedProfile.target_ratio_max,
    });
  }, [selectedProfile, debouncedTimeS, ratio]);

  const quickNotes = settings?.quick_notes_chips || [
    "equilibrado",
    "ácido",
    "amargo",
    "dulce",
    "sub-extraído",
    "sobre-extraído",
  ];

  const handleApprove = async () => {
    if (!selectedProfileId || !profile?.id) return;

    const grinder = selectedProfile?.grinders;
    const clicksPerPoint =
      grinder && typeof grinder === "object" && "clicks_per_point" in grinder
        ? (grinder as any).clicks_per_point
        : 1;
    const previousGrindPoints = approvedEntry?.grind_points;
    const clicksDelta =
      previousGrindPoints !== undefined
        ? Math.round((grindPoints - previousGrindPoints) * clicksPerPoint)
        : 0;

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
      grind_label: null,
      grinder_clicks_delta: clicksDelta,
      notes_tags: notesTags,
      notes_text: notesText || null,
      suggestion_shown: "",
    };

    try {
      const result = await createEntry.mutateAsync(entryData);
      await approveEntry.mutateAsync(result.id);

      toast({
        title: "¡Calibración aprobada! ✓",
        description: "La calibración se guardó exitosamente",
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar la calibración",
        variant: "destructive",
      });
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

  const isValid = semaphore?.overallStatus !== "error" && doseG > 0 && yieldValue > 0 && timeS > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] p-0 gap-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 h-full">
          {/* LEFT: Coffee Selection & Status */}
          <div className="lg:col-span-1 p-6 border-r bg-muted/20 space-y-4 overflow-y-auto">
            {/* Header */}
            <div>
              <h2 className="text-xl font-bold">Calibración Diaria</h2>
              <p className="text-sm text-muted-foreground">Selecciona el café y turno</p>
            </div>

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
                  >
                    {shift}
                  </Button>
                ))}
              </div>
            </div>

            {/* Coffee Cards */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Café</label>
              <div className="space-y-2">
                {coffeeProfiles.length === 0 ? (
                  <Card className="p-4 text-center text-sm text-muted-foreground">
                    No hay perfiles de café configurados
                  </Card>
                ) : (
                  coffeeProfiles.map((profile) => (
                    <Card
                      key={profile.id}
                      className={cn(
                        "p-4 cursor-pointer transition-all hover-scale",
                        selectedProfileId === profile.id
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/50"
                      )}
                      onClick={() => setSelectedProfileId(profile.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Coffee className="w-5 h-5 text-primary" />
                        <div className="flex-1">
                          <div className="font-semibold">{profile.name}</div>
                          {profile.lote && (
                            <div className="text-xs text-muted-foreground">
                              Lote: {profile.lote}
                            </div>
                          )}
                        </div>
                        {selectedProfileId === profile.id && (
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
                  >
                    Ajustar
                  </Button>
                </div>
              </Card>
            )}

            <Separator />

            {/* Semaphore Status */}
            <div className="space-y-3">
              <label className="text-sm font-semibold">Estado</label>
              <Card className="p-6 text-center">
                <div
                  className={cn(
                    "w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl shadow-lg",
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
                <div className="text-xs text-muted-foreground mt-1">
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
                  step={0.5}
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
                  step={1}
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
                  step={1}
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
                  step={0.5}
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
                  if (!selectedProfileId || !profile?.id) return;

                  const grinder = selectedProfile?.grinders;
                  const clicksPerPoint =
                    grinder && typeof grinder === "object" && "clicks_per_point" in grinder
                      ? (grinder as any).clicks_per_point
                      : 1;
                  const previousGrindPoints = approvedEntry?.grind_points;
                  const clicksDelta =
                    previousGrindPoints !== undefined
                      ? Math.round((grindPoints - previousGrindPoints) * clicksPerPoint)
                      : 0;

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
                disabled={!selectedProfileId || createEntry.isPending}
                className="h-14 text-base font-semibold"
                size="lg"
              >
                Guardar Borrador
              </Button>
              
              <Button
                onClick={handleApprove}
                disabled={!isValid || !selectedProfileId || createEntry.isPending}
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
      </DialogContent>
    </Dialog>
  );
}
