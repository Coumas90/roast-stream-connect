import { describe, it, expect, vi } from "vitest";
import { upsertConsumptionRpc } from "@/integrations/consumption/consumption.rpc";

function makePayload() {
  return {
    clientId: "c1",
    locationId: "l1",
    provider: "fudo",
    date: "2025-01-15",
    total: 100,
    orders: 5,
    items: 8,
    discounts: 2,
    taxes: 10,
    meta: { a: 1 },
  };
}

describe("upsertConsumptionRpc", () => {
  it("calls RPC with underscored params and returns id", async () => {
    const mockUuid = "11111111-2222-3333-4444-555555555555";
    const rpc = vi.fn().mockResolvedValue({ data: mockUuid, error: null });
    const supabase: any = { rpc };

    const payload = makePayload();
    const result = await upsertConsumptionRpc(supabase, payload);

    expect(result).toEqual({ id: mockUuid });
    expect(rpc).toHaveBeenCalledWith("upsert_consumption", {
      _client_id: payload.clientId,
      _location_id: payload.locationId,
      _provider: payload.provider,
      _date: payload.date,
      _total: payload.total,
      _orders: payload.orders,
      _items: payload.items,
      _discounts: payload.discounts,
      _taxes: payload.taxes,
      _meta: payload.meta,
    });
  });

  it("propagates forbidden error", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "forbidden" } });
    const supabase: any = { rpc };

    await expect(upsertConsumptionRpc(supabase, makePayload())).rejects.toThrow("forbidden");
    expect(rpc).toHaveBeenCalled();
  });
});
