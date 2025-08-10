import type { TupaSale } from "../../../../sdk/pos";
import type { BistrosoftSale } from "./types";

export function toTupaSales(raw: BistrosoftSale[]): TupaSale[] {
  return (raw ?? []).map((r) => {
    const occurred_at = new Date(r.datetime as any).toISOString();
    const items = (r.lines ?? []).map((l) => ({
      sku: l.sku,
      name: l.name,
      qty: l.quantity,
      price: l.unit_price,
    }));
    const meta: Record<string, unknown> = { provider: "bistrosoft" };
    if (typeof r.discounts_total === "number") meta.discounts_total = r.discounts_total;
    if (typeof r.taxes_total === "number") meta.taxes_total = r.taxes_total;

    return {
      external_id: String(r.id),
      occurred_at,
      total: Number(r.total ?? 0),
      status: r.status,
      items,
      meta,
    } satisfies TupaSale;
  });
}
