// RPC wrapper for upsert_consumption
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TupaConsumption } from "./consumption";

export type UpsertConsumptionInput = Pick<
  TupaConsumption,
  | "clientId"
  | "locationId"
  | "provider"
  | "date"
  | "total"
  | "orders"
  | "items"
  | "discounts"
  | "taxes"
  | "meta"
>;

export async function upsertConsumptionRpc(
  supabase: SupabaseClient,
  payload: UpsertConsumptionInput
): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc("upsert_consumption" as any, {
    _client_id: payload.clientId,
    _location_id: payload.locationId,
    _provider: payload.provider,
    _date: payload.date, // YYYY-MM-DD (UTC)
    _total: payload.total,
    _orders: payload.orders,
    _items: payload.items,
    _discounts: payload.discounts,
    _taxes: payload.taxes,
    _meta: payload.meta ?? {},
  });

  if (error) throw new Error(error.message);
  return { id: data as string };
}
