import type { Database as BaseDatabase } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

// POS augmentation types without relying on `any`
export type AppPosProvider = "fudo" | "maxirest" | "bistrosoft" | "other";

export type PosTenantRow = {
  id: string;
  tenant_id: string;
  provider: AppPosProvider;
  connected: boolean;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type PosLocationRow = {
  id: string;
  location_id: string;
  provider: AppPosProvider;
  connected: boolean;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type PosAugmentedDatabase = BaseDatabase & {
  public: BaseDatabase["public"] & {
    Enums: BaseDatabase["public"]["Enums"] & {
      app_pos_provider: AppPosProvider;
    };
    Tables: BaseDatabase["public"]["Tables"] & {
      pos_integrations_tenant: {
        Row: PosTenantRow;
        Insert: Partial<Pick<PosTenantRow, "id" | "created_at" | "updated_at">> & {
          tenant_id: string;
          provider: AppPosProvider;
          connected: boolean;
          config?: Record<string, unknown> | null;
        };
        Update: Partial<PosTenantRow>;
        Relationships: never[];
      };
      pos_integrations_location: {
        Row: PosLocationRow;
        Insert: Partial<Pick<PosLocationRow, "id" | "created_at" | "updated_at">> & {
          location_id: string;
          provider: AppPosProvider;
          connected: boolean;
          config?: Record<string, unknown> | null;
        };
        Update: Partial<PosLocationRow>;
        Relationships: never[];
      };
    };
    Functions: BaseDatabase["public"]["Functions"] & {
      effective_pos: {
        Args: { _tenant_id: string; _location_id: string | null };
        Returns: { provider: AppPosProvider; source: string; connected: boolean }[];
      };
      set_pos_tenant: {
        Args: {
          _tenant_id: string;
          _provider: AppPosProvider;
          _connected: boolean;
          _config?: Record<string, unknown> | null;
        };
        Returns: void;
      };
      set_pos_location: {
        Args: {
          _location_id: string;
          _provider: AppPosProvider;
          _connected: boolean;
          _config?: Record<string, unknown> | null;
        };
        Returns: void;
      };
    };
  };
};

export type PosSupabaseClient = SupabaseClient<PosAugmentedDatabase>;
