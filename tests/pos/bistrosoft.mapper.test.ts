import { describe, it, expect } from "vitest";
import { toTupaSales } from "../../../src/integrations/pos/bistrosoft/mapper";
import type { BistrosoftSale } from "../../../src/integrations/pos/bistrosoft/types";

describe("Bistrosoft mapper", () => {
  it("maps a simple sale and preserves totals/discounts/taxes", () => {
    const raw: BistrosoftSale = {
      id: 42,
      datetime: "2025-02-01 14:30:00",
      total: 25.5,
      status: "closed",
      lines: [ { sku: "LATTE", name: "Latte", quantity: 1, unit_price: 25.5 } ],
      discounts_total: 0,
      taxes_total: 0,
    };

    const [sale] = toTupaSales([raw]);

    expect(sale.external_id).toBe("42");
    expect(sale.occurred_at).toBe(new Date(raw.datetime).toISOString());
    expect(sale.total).toBeCloseTo(25.5, 1);
    expect(sale.items?.[0]).toEqual({ sku: "LATTE", name: "Latte", qty: 1, price: 25.5 });
    expect(sale.meta?.provider).toBe("bistrosoft");
    expect(sale.meta?.discounts_total).toBe(0);
    expect(sale.meta?.taxes_total).toBe(0);
  });
});
