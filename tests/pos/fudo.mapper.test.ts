import { describe, it, expect } from "vitest";
import { toTupaSales } from "../../../src/integrations/pos/fudo/mapper";
import type { FudoSale } from "../../../src/integrations/pos/fudo/types";

describe("Fudo mapper", () => {
  it("maps a simple sale correctly to TupaSale", () => {
    const raw: FudoSale = {
      id: "sale-1",
      created_at: "2025-01-01T10:00:00-03:00",
      total: 19.98,
      status: "paid",
      items: [
        { sku: "ABC", name: "Cafe", quantity: 2, price: 9.99 },
      ],
    };

    const [sale] = toTupaSales([raw]);

    expect(sale.external_id).toBe("sale-1");
    expect(sale.occurred_at).toBe(new Date(raw.created_at).toISOString());
    expect(sale.total).toBeCloseTo(19.98, 2);
    expect(sale.status).toBe("paid");
    expect(sale.items?.length).toBe(1);
    expect(sale.items?.[0]).toEqual({ sku: "ABC", name: "Cafe", qty: 2, price: 9.99 });
  });
});
