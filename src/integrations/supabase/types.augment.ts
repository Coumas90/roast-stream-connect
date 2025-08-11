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
          provider: string; // app_pos_provider
          status: string | null; // 'running' | 'success' | 'error'
          attempt: number | null;
          started_at: string;
          finished_at: string | null;
          duration_ms: number | null;
          count: number | null;
          error: string | null;
          meta: Json; // may be non-null with default '{}'
          // legacy/compat
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
    };
  };
};
