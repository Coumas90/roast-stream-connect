import type { TupaSale } from "../../../../sdk/pos";
import type { FudoSale } from "./types";

export function toTupaSales(raw: FudoSale[]): TupaSale[] {
  return (raw ?? []).map((r) => {
    const occurred = new Date(r.created_at as any).toISOString();
    const items = (r.items ?? []).map((it) => ({
      sku: it.sku,
      name: it.name,
      qty: it.quantity,
      price: it.price,
    }));
    return {
      external_id: String(r.id),
      occurred_at: occurred,
      total: Number(r.total ?? 0),
      status: r.status,
      items,
      meta: { provider: "fudo" },
    } satisfies TupaSale;
  });
}
