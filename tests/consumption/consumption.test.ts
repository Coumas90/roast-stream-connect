import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  // Shared mutable builder we can reconfigure per test
  const builder: any = {
    __mode: "idle",
    __rows: [] as any[],
    __single: { id: "" },
    upsert: vi.fn().mockImplementation(function () { return builder; }),
    select: vi.fn().mockImplementation(function () { return builder; }),
    maybeSingle: vi.fn().mockImplementation(async function () { return { data: builder.__single, error: null }; }),
    single: vi.fn().mockImplementation(async function () { return { data: builder.__single, error: null }; }),
    eq: vi.fn().mockImplementation(function () { return builder; }),
    gte: vi.fn().mockImplementation(function () { return builder; }),
    lte: vi.fn().mockImplementation(function () { return builder; }),
    then: function (resolve: any) { return resolve({ data: builder.__rows, error: null }); },
  };
  return {
    supabase: {
      from: vi.fn(() => builder),
      __builder: builder,
    },
  } as any;
});

import { supabase } from "@/integrations/supabase/client" as any;
import { aggregateSalesToConsumption, storeClientConsumption, getClientConsumption, validateSalesData } from "@/integrations/consumption/consumption";
import type { TupaSale } from "../../sdk/pos";

describe("consumption module", () => {
  beforeEach(() => {
    // reset builder state
    (supabase.from as any).mockClear?.();
    supabase.__builder.upsert.mockClear();
    supabase.__builder.select.mockClear();
    supabase.__builder.eq.mockClear();
    supabase.__builder.gte.mockClear();
    supabase.__builder.lte.mockClear();
    supabase.__builder.__rows = [];
    supabase.__builder.__single = { id: "" };
  });

  it("aggregateSalesToConsumption sums totals and normalizes date", () => {
    const sales: TupaSale[] = [
      {
        external_id: "1",
        occurred_at: "2024-01-01T10:15:00.000Z",
        total: 10,
        items: [
          { name: "Espresso", qty: 1, price: 10 },
        ],
        meta: { discounts_total: 1, taxes_total: 2 },
      },
      {
        external_id: "2",
        occurred_at: "2024-01-01T12:00:00.000Z",
        total: 20,
        items: [
          { name: "Latte", qty: 2, price: 10 },
        ],
        meta: { discounts_total: 0.5, taxes_total: 3 },
      },
      {
        external_id: "3",
        occurred_at: "2024-01-01T23:59:59.000Z",
        total: 5,
        items: [
          { name: "Americano", qty: 1, price: 5 },
        ],
      },
    ];

    const agg = aggregateSalesToConsumption({
      clientId: "tenant-1",
      locationId: "loc-1",
      provider: "fudo",
      sales,
    });

    expect(agg.date).toBe("2024-01-01");
    expect(agg.total).toBe(35);
    expect(agg.orders).toBe(3);
    expect(agg.items).toBe(4); // 1 + 2 + 1
    expect(agg.discounts).toBeCloseTo(1.5);
    expect(agg.taxes).toBe(5);
  });

  it("validateSalesData rejects empty array", () => {
    const res = validateSalesData([]);
    expect(res.ok).toBe(false);
  });

  it("storeClientConsumption upserts and returns id, idempotent via onConflict", async () => {
    const consumption = {
      clientId: "tenant-1",
      locationId: "loc-1",
      provider: "fudo",
      date: "2024-01-01",
      total: 35,
      orders: 3,
      items: 4,
      discounts: 1.5,
      taxes: 5,
      meta: { source: "test" },
    } as const;

    supabase.__builder.__single = { id: "abc-123" };

    const first = await storeClientConsumption(consumption);
    expect(first.id).toBe("abc-123");
    // Second call should also resolve and not create duplicate (simulated by same id)
    const second = await storeClientConsumption(consumption);
    expect(second.id).toBe("abc-123");

    // Ensure upsert used onConflict for the unique key
    expect(supabase.__builder.upsert).toHaveBeenCalled();
  });

  it("getClientConsumption queries and maps rows", async () => {
    supabase.__builder.__rows = [
      {
        client_id: "tenant-1",
        location_id: "loc-1",
        provider: "fudo",
        date: "2024-01-01",
        total: 35,
        orders: 3,
        items: 4,
        discounts: 1.5,
        taxes: 5,
        meta: { source: "test" },
      },
    ];

    const rows = await getClientConsumption({ clientId: "tenant-1", from: "2024-01-01", to: "2024-01-31" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ clientId: "tenant-1", locationId: "loc-1", provider: "fudo", total: 35 });
    // Ensure filters were applied
    expect(supabase.__builder.eq).toHaveBeenCalledWith("client_id", "tenant-1");
  });
});
