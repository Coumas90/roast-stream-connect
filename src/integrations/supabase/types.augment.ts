// Augmented Supabase Database types including 'consumptions' table
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
    };
  };
};
