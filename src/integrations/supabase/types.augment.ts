// Augmented Supabase Database types including 'consumptions' table and POS sync tables
import type { Database as Base } from "./types";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export type ConsumptionAugmentedDatabase = Base & {
  public: Base["public"] & {
    Tables: Base["public"]["Tables"] & {
      consumptions: {
        Row: {
          id: string;
          client_id: string;
          location_id: string;
          provider: string;
          date: string; // date (YYYY-MM-DD)
          total: number;
          orders: number;
          items: number;
          discounts: number;
          taxes: number;
          meta: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          location_id: string;
          provider: string;
          date: string; // YYYY-MM-DD
          total?: number;
          orders?: number;
          items?: number;
          discounts?: number;
          taxes?: number;
          meta?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          id: string;
          client_id: string;
          location_id: string;
          provider: string;
          date: string;
          total: number;
          orders: number;
          items: number;
          discounts: number;
          taxes: number;
          meta: Json;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      pos_sync_status: {
        Row: {
          location_id: string;
          provider: string; // app_pos_provider
          consecutive_failures: number;
          last_run_at: string | null;
          last_error: string | null;
          next_attempt_at: string | null;
          paused_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          location_id: string;
          provider: string;
          consecutive_failures?: number;
          last_run_at?: string | null;
          last_error?: string | null;
          next_attempt_at?: string | null;
          paused_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          location_id: string;
          provider: string;
          consecutive_failures: number;
          last_run_at: string | null;
          last_error: string | null;
          next_attempt_at: string | null;
          paused_until: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      pos_sync_runs: {
        Row: {
          id: string;
          client_id: string | null;
          location_id: string;
          provider: string;
          status: string | null;
          attempt: number | null;
          started_at: string;
          finished_at: string | null;
          duration_ms: number | null;
          count: number | null;
          error: string | null;
          meta: Json;
          kind: string | null;
          ok: boolean;
          items: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          location_id: string;
          provider: string;
          status?: string | null;
          attempt?: number | null;
          started_at?: string;
          finished_at?: string | null;
          duration_ms?: number | null;
          count?: number | null;
          error?: string | null;
          meta?: Json;
          kind?: string | null;
          ok?: boolean;
          items?: number;
          updated_at?: string;
        };
        Update: Partial<{
          id: string;
          client_id: string | null;
          location_id: string;
          provider: string;
          status: string | null;
          attempt: number | null;
          started_at: string;
          finished_at: string | null;
          duration_ms: number | null;
          count: number | null;
          error: string | null;
          meta: Json;
          kind: string | null;
          ok: boolean;
          items: number;
          updated_at: string;
        }>;
        Relationships: [];
      };
      grinders: {
        Row: {
          id: string;
          location_id: string;
          name: string;
          model: string | null;
          clicks_per_point: number;
          notes: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          name: string;
          model?: string | null;
          clicks_per_point?: number;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          id: string;
          location_id: string;
          name: string;
          model: string | null;
          clicks_per_point: number;
          notes: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      coffee_profiles: {
        Row: {
          id: string;
          tenant_id: string;
          location_id: string;
          grinder_id: string | null;
          name: string;
          lote: string | null;
          tueste: string | null;
          brew_method: string;
          target_dose_g: number;
          target_ratio_min: number;
          target_ratio_max: number;
          target_time_min: number;
          target_time_max: number;
          target_temp_c: number;
          target_yield_unit: string;
          water_profile_id: string | null;
          humidity_hint: boolean;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          location_id: string;
          grinder_id?: string | null;
          name: string;
          lote?: string | null;
          tueste?: string | null;
          brew_method: string;
          target_dose_g?: number;
          target_ratio_min?: number;
          target_ratio_max?: number;
          target_time_min?: number;
          target_time_max?: number;
          target_temp_c?: number;
          target_yield_unit?: string;
          water_profile_id?: string | null;
          humidity_hint?: boolean;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          id: string;
          tenant_id: string;
          location_id: string;
          grinder_id: string | null;
          name: string;
          lote: string | null;
          tueste: string | null;
          brew_method: string;
          target_dose_g: number;
          target_ratio_min: number;
          target_ratio_max: number;
          target_time_min: number;
          target_time_max: number;
          target_temp_c: number;
          target_yield_unit: string;
          water_profile_id: string | null;
          humidity_hint: boolean;
          active: boolean;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      calibration_entries: {
        Row: {
          id: string;
          coffee_profile_id: string;
          barista_id: string;
          turno: string;
          fecha: string;
          dose_g: number;
          yield_value: number;
          yield_unit: string;
          time_s: number;
          temp_c: number;
          grind_points: number;
          grind_label: string | null;
          grinder_clicks_delta: number;
          ratio_calc: number | null;
          notes_tags: string[];
          notes_text: string | null;
          is_override: boolean;
          suggestion_shown: string | null;
          approved: boolean;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          coffee_profile_id: string;
          barista_id: string;
          turno: string;
          fecha?: string;
          dose_g: number;
          yield_value: number;
          yield_unit?: string;
          time_s: number;
          temp_c: number;
          grind_points: number;
          grind_label?: string | null;
          grinder_clicks_delta?: number;
          ratio_calc?: number | null;
          notes_tags?: string[];
          notes_text?: string | null;
          is_override?: boolean;
          suggestion_shown?: string | null;
          approved?: boolean;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<{
          id: string;
          coffee_profile_id: string;
          barista_id: string;
          turno: string;
          fecha: string;
          dose_g: number;
          yield_value: number;
          yield_unit: string;
          time_s: number;
          temp_c: number;
          grind_points: number;
          grind_label: string | null;
          grinder_clicks_delta: number;
          ratio_calc: number | null;
          notes_tags: string[];
          notes_text: string | null;
          is_override: boolean;
          suggestion_shown: string | null;
          approved: boolean;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        }>;
        Relationships: [];
      };
      calibration_settings: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: Partial<{
          key: string;
          value: Json;
          description: string | null;
          updated_at: string;
          updated_by: string | null;
        }>;
        Relationships: [];
      };
    };
  };
};
