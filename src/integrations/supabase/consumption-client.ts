// Typed client for the augmented Database including 'consumptions' table
import { supabase } from "./client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConsumptionAugmentedDatabase } from "./types.augment";

export const consumptionSupabase = supabase as SupabaseClient<ConsumptionAugmentedDatabase>;
