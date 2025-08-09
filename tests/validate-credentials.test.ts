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
import { validateCredentials } from "@/lib/pos/api";

describe("validate-credentials (mocked)", () => {
  beforeEach(() => {
    (supabase.functions.invoke as any).mockReset();
  });

  const providers = ["fudo", "maxirest", "bistrosoft", "other"] as const;

  providers.forEach((p) => {
    it(`ok with non-empty key for ${p}`, async () => {
      (supabase.functions.invoke as any).mockResolvedValueOnce({ data: { valid: true }, error: null });
      const { data, error } = await validateCredentials(p, "key-123");
      expect(error).toBeNull();
      expect(data).toEqual({ valid: true });
      expect(supabase.functions.invoke).toHaveBeenCalledWith("validate-credentials", { body: { provider: p, apiKey: "key-123" } });
    });

    it(`invalid when provider unsupported or empty key for ${p}`, async () => {
      (supabase.functions.invoke as any).mockResolvedValueOnce({ data: { valid: false, error: "Invalid payload" }, error: null });
      const { data } = await validateCredentials(p, "");
      expect(data?.valid).toBe(false);
    });
  });
});
