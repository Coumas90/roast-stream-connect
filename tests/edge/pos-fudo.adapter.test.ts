import { describe, it, expect, vi, beforeEach } from "vitest";
import { fudoGetToken, fudoFetchSalesWindow } from "../../supabase/functions/pos-sync/index.ts";

function makeResp(body: any, init: number | ResponseInit = 200) {
  const status = typeof init === "number" ? init : init.status ?? 200;
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("Fudo adapter (edge helpers)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getToken: returns token on 200", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce(makeResp({ token: "abc123", exp: 999 }, 200));
    const res = await fudoGetToken({ apiKey: "k", apiSecret: "s", env: "production" });
    expect((res as any).token).toBe("abc123");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("getToken: throws 401 maps correctly", async () => {
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce(makeResp({ error: "unauthorized" }, 401));
    await expect(fudoGetToken({ apiKey: "k", apiSecret: "s", env: "staging" })).rejects.toMatchObject({ status: 401 });
  });

  it("fetchSalesWindow: paginates until <500", async () => {
    const page1 = Array.from({ length: 500 }, (_, i) => ({ total: 10, items: [{ quantity: 1 }, { quantity: 2 }], created_at: `2024-01-01T00:00:${String(i).padStart(2, "0")}Z` }));
    const page2 = Array.from({ length: 200 }, (_, i) => ({ total: 5, items: [{ quantity: 3 }], created_at: `2024-01-01T01:00:${String(i).padStart(2, "0")}Z` }));

    const fetchSpy = vi.spyOn(globalThis, "fetch" as any)
      // page 1
      .mockResolvedValueOnce(makeResp({ data: page1 }, 200))
      // page 2
      .mockResolvedValueOnce(makeResp({ data: page2 }, 200));

    const out = await fudoFetchSalesWindow({ from: "2024-01-01", to: "2024-01-01", token: "tkn", env: "production" });
    expect(out.length).toBe(700);
    // validate a couple of mapped fields
    expect(out[0].total).toBe(10);
    expect(Array.isArray(out[0].items)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("fetchSalesWindow: throws AUTH_401 on 401/403", async () => {
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce(makeResp({ error: "unauthorized" }, 401));
    await expect(fudoFetchSalesWindow({ from: "2024-01-01", to: "2024-01-01", token: "bad", env: "staging" })).rejects.toMatchObject({ code: "AUTH_401" });
  });
});
