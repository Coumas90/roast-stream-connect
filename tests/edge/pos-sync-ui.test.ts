import { describe, it, expect } from "vitest";
import { handlePosSyncUiRequest } from "../../supabase/functions/pos-sync-ui/index.ts";

function makeReq(body: any, token = "bearer") {
  return new Request("http://localhost/functions/v1/pos-sync-ui", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

const uuidLoc = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const uuidTen = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function svc(userCan: boolean, invokeData: any = { skipped: true, reason: "backoff", waitMs: 1000 }) {
  return {
    rpc: async (name: string) => ({ data: userCan === true, error: null }),
    from(table: string) {
      return {
        select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { tenant_id: uuidTen }, error: null }),
      } as any;
    },
    functions: {
      invoke: async () => ({ data: invokeData, error: null }),
    },
  } as any;
}

describe("pos-sync-ui permissions and proxying", () => {
  it("forbidden when user cannot manage pos", async () => {
    const res = await handlePosSyncUiRequest(makeReq({ locationId: uuidLoc, provider: "bistrosoft" }), { userClient: svc(false), svc: svc(false) });
    expect(res.status).toBe(403);
  });

  it("passes through response when allowed", async () => {
    const response = { runId: "r1", count: 5 };
    const res = await handlePosSyncUiRequest(makeReq({ locationId: uuidLoc, provider: "bistrosoft" }), { userClient: svc(true), svc: svc(true, response) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(response);
  });
});
