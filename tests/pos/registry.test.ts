import { describe, it, expect } from "vitest";
import { getAvailablePOSTypes } from "../../../src/integrations/pos/registry";

describe("POS registry", () => {
  it("returns exactly Fudo and Bistrosoft with correct meta", () => {
    const meta = getAvailablePOSTypes();
    const ids = meta.map((m) => m.id).sort();

    expect(ids).toEqual(["bistrosoft", "fudo"]);

    const fudo = meta.find((m) => m.id === "fudo")!;
    expect(fudo.batchLimit).toBe(1000);
    expect(fudo.realtime).toBe(true);

    const bistro = meta.find((m) => m.id === "bistrosoft")!;
    expect(bistro.batchLimit).toBe(500);
    expect(bistro.realtime).toBe(false);
  });
});
