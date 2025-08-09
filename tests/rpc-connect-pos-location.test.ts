import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/pos-client", () => {
  return {
    posSupabase: {
      rpc: vi.fn(),
    },
  } as any;
});

import { posSupabase } from "@/integrations/supabase/pos-client";
import { connectPosLocationRpc } from "@/lib/pos/rpc";

describe("RPC: connect_pos_location (mocked)", () => {
  const locationId = "loc-456";

  beforeEach(() => {
    (posSupabase.rpc as any).mockReset();
  });

  it("success with valid key and permissions", async () => {
    (posSupabase.rpc as any).mockResolvedValueOnce({ data: null, error: null });
    const { error } = await connectPosLocationRpc(locationId, "fudo", "key-ok");
    expect(error).toBeNull();
    expect(posSupabase.rpc).toHaveBeenCalledWith("connect_pos_location", {
      _location_id: locationId,
      _provider: "fudo",
      _api_key: "key-ok",
    });
  });

  it("permission denied returns forbidden error", async () => {
    (posSupabase.rpc as any).mockResolvedValueOnce({ data: null, error: { message: "forbidden" } });
    const { error } = await connectPosLocationRpc(locationId, "maxirest", "key-ok");
    expect(error?.message).toContain("forbidden");
  });

  it("invalid api key bubbles up reason", async () => {
    (posSupabase.rpc as any).mockResolvedValueOnce({ data: null, error: { message: "API key inválida" } });
    const { error } = await connectPosLocationRpc(locationId, "bistrosoft", "bad");
    expect(error?.message).toContain("API key inválida");
  });
});
