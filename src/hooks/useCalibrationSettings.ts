import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CalibrationSettings {
  density_conversion: number;
  default_ranges: {
    espresso: {
      time_min: number;
      time_max: number;
      ratio_min: number;
      ratio_max: number;
    };
  };
  default_steps: {
    dose_g: number;
    time_s: number;
    temp_c: number;
    grind_points: number;
  };
  max_grind_delta: number;
  quick_notes_chips: string[];
}

export function useCalibrationSettings() {
  return useQuery({
    queryKey: ["calibration-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calibration_settings")
        .select("*");

      if (error) throw error;

      // Convert array to object with typed values
      const settings: any = {};
      data.forEach((setting) => {
        const value = setting.value;
        if (typeof value === "string") {
          settings[setting.key] = parseFloat(value);
        } else if (Array.isArray(value)) {
          settings[setting.key] = value;
        } else {
          settings[setting.key] = value;
        }
      });

      return settings as CalibrationSettings;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
