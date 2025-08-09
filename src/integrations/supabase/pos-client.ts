import { supabase } from "./client";
import type { PosSupabaseClient } from "./pos-types";

// Centralized typed POS client to avoid local casts in modules
export const posSupabase = supabase as PosSupabaseClient;
