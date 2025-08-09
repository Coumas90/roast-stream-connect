import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      functions: {
        invoke: vi.fn(),
      },
    },
  } as any;
});

import { supabase } from "@/integrations/supabase/client";
import { connectPosLocation } from "@/lib/pos/api";

describe("connect-pos-location (mocked)", () => {
  beforeEach(() => {
    (supabase.functions.invoke as any).mockReset();
  });

  const locationId = "loc-123";

  it("success with valid key and permissions", async () => {
    (supabase.functions.invoke as any).mockResolvedValueOnce({ data: { ok: true }, error: null });
    const { data, error } = await connectPosLocation(locationId, "fudo", "k-abc");
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);
  });

  it("permission denied shows forbidden", async () => {
    (supabase.functions.invoke as any).mockResolvedValueOnce({ data: null, error: { message: "forbidden" } });
    const { error } = await connectPosLocation(locationId, "fudo", "k-abc");
    expect(error?.message).toContain("forbidden");
  });

  it("invalid api key bubble up reason", async () => {
    (supabase.functions.invoke as any).mockResolvedValueOnce({ data: null, error: { message: "API key inválida" } });
    const { error } = await connectPosLocation(locationId, "fudo", "bad-key");
    expect(error?.message).toContain("API key");
  });
});
