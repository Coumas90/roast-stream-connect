import { supabase } from "@/integrations/supabase/client";
import type { TupaSale } from "../../../sdk/pos";

export type TupaConsumption = {
  clientId: string;
  locationId: string;
  provider: string;
  date: string; // YYYY-MM-DD (UTC)
  total: number;
  orders: number;
  items: number;
  discounts: number;
  taxes: number;
  meta?: Record<string, unknown>;
};

export function validateSalesData(sales: TupaSale[]): { ok: true } | { ok: false; reason: string } {
  if (!Array.isArray(sales)) return { ok: false, reason: "sales must be an array" };
  if (sales.length === 0) return { ok: false, reason: "no sales provided" };
  for (const s of sales) {
    if (!s || typeof s.external_id !== "string") return { ok: false, reason: "invalid sale: missing external_id" };
    if (!s.occurred_at) return { ok: false, reason: "invalid sale: missing occurred_at" };
    if (typeof s.total !== "number") return { ok: false, reason: "invalid sale: missing total" };
  }
  return { ok: true };
}

function toUTCDateOnly(input: string | Date): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function aggregateSalesToConsumption(args: {
  clientId: string;
  locationId: string;
  provider: string;
  date?: string | Date; // optional override
  sales: TupaSale[];
  meta?: Record<string, unknown>;
}): TupaConsumption {
  const { clientId, locationId, provider, sales } = args;
  const date = args.date ? toUTCDateOnly(args.date) : toUTCDateOnly(sales[0]?.occurred_at ?? new Date());

  let total = 0;
  let orders = 0;
  let items = 0;
  let discounts = 0;
  let taxes = 0;

  for (const s of sales ?? []) {
    orders += 1;
    total += Number(s.total ?? 0);
    const saleItems = s.items ?? [];
    for (const it of saleItems) {
      items += Number(it.qty ?? 0);
    }
    const meta = s.meta as Record<string, unknown> | undefined;
    const d = meta?.["discounts_total"];
    const t = meta?.["taxes_total"];
    if (typeof d === "number") discounts += d;
    if (typeof t === "number") taxes += t;
  }

  return {
    clientId,
    locationId,
    provider,
    date,
    total,
    orders,
    items,
    discounts,
    taxes,
    meta: args.meta,
  };
}

export async function storeClientConsumption(consumption: TupaConsumption): Promise<{ id: string }> {
  const payload = {
    client_id: consumption.clientId,
    location_id: consumption.locationId,
    provider: consumption.provider,
    date: consumption.date,
    total: consumption.total,
    orders: consumption.orders,
    items: consumption.items,
    discounts: consumption.discounts,
    taxes: consumption.taxes,
    meta: consumption.meta ?? {},
  } as const;

  const { data, error } = await supabase
    .from("consumptions")
    .upsert(payload, { onConflict: "client_id,location_id,provider,date" })
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("upsert failed: missing id");
  return { id: data.id };
}

export async function getClientConsumption(args: {
  clientId: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  locationId?: string;
}): Promise<TupaConsumption[]> {
  const { clientId, from, to, locationId } = args;
  // Build query step-by-step to ease testing/mocking
  let query: any = supabase.from("consumptions").select(
    "client_id, location_id, provider, date, total, orders, items, discounts, taxes, meta"
  );
  query = query.eq("client_id", clientId).gte("date", from).lte("date", to);
  if (locationId) query = query.eq("location_id", locationId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((r: any) => ({
    clientId: r.client_id,
    locationId: r.location_id,
    provider: r.provider,
    date: r.date,
    total: Number(r.total ?? 0),
    orders: Number(r.orders ?? 0),
    items: Number(r.items ?? 0),
    discounts: Number(r.discounts ?? 0),
    taxes: Number(r.taxes ?? 0),
    meta: r.meta ?? {},
  } satisfies TupaConsumption));
}
