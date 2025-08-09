import { posSupabase } from "@/integrations/supabase/pos-client";
import type { AppPosProvider } from "@/integrations/supabase/pos-types";

export async function connectPosLocationRpc(locationId: string, provider: AppPosProvider, apiKey: string) {
  // Wrapper around RPC to keep tests and callers typed and simple
  return posSupabase.rpc("connect_pos_location" as any, {
    _location_id: locationId as any,
    _provider: provider as any,
    _api_key: apiKey as any,
  });
}
