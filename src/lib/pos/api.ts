export type ValidateProvider = "fudo" | "maxirest" | "bistrosoft" | "other";
import { supabase } from "@/integrations/supabase/client";

export async function validateCredentials(provider: ValidateProvider, apiKey: string) {
  const { data, error } = await supabase.functions.invoke("validate-credentials", {
    body: { provider, apiKey },
  });
  return { data: (data as any) ?? null, error };
}

export async function connectPosLocation(locationId: string, provider: ValidateProvider, apiKey: string) {
  const { data, error } = await supabase.functions.invoke("connect-pos-location", {
    body: { locationId, provider, apiKey },
  });
  return { data: (data as any) ?? null, error };
}
