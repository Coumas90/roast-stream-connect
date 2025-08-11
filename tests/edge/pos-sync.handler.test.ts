import { describe, it, expect, beforeEach, vi } from "vitest";

// Dynamic mock for crypto
let decryptMock = vi.fn();
vi.mock("../../supabase/functions/_shared/crypto", () => ({
  decryptAESGCM: (...args: any[]) => decryptMock(...args),
}));

type Svc = {
  from: (t: string) => any;
  functions: { invoke: (name: string, opts: any) => Promise<{ data?: any; error?: any }> };
  rpc: (name: string, args: any) => Promise<{ data?: any; error?: any }>;
};

function makeReq(body: any) {
  const headers = new Headers({ "content-type": "application/json", "X-Job-Token": "t0k" });
  return new Request("http://localhost/functions/v1/pos-sync", { method: "POST", headers, body: JSON.stringify(body) });
}

const uuidA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const uuidB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function kms() { return "a".repeat(64); }

function svcFactory(overrides: any = {}): Svc {
  const state: any = { updates: [], invokes: [] };

  const svc: Svc = {
    from(table: string) {
      return {
        select() { return this; },
        eq() { return this; },
        match() { return this; },
        in() { return this; },
        maybeSingle: async () => {
          if (table === "pos_provider_credentials") return { data: overrides.credRow ?? null, error: null };
          if (table === "pos_sync_status") return { data: overrides.syncStatus ?? null, error: null };
          if (table === "locations") return { data: overrides.locRow ?? { id: uuidB, tenant_id: uuidA }, error: null };
          return { data: null, error: null };
        },
        update: (payload: any) => {
          state.updates.push({ table, payload });
          return { eq() { return this; } } as any;
        },
      } as any;
    },
    functions: {
      invoke: async (name: string, opts: any) => {
        state.invokes.push({ name, body: opts?.body });
        if (name === "pos-sync-logger" && opts?.body?.action === "start") {
          return { data: { runId: "run_test" } } as any;
        }
        return { data: {} } as any;
      },
    },
    rpc: async (name: string) => {
      if (overrides.rpcError) return { error: { message: "rpc_error" } } as any;
      return { data: null, error: null } as any;
    },
  };
  (svc as any).__state = state;
  return svc;
}

// Stub Deno env for job token
(globalThis as any).Deno = { env: { get: (k: string) => (k === "POS_SYNC_JOB_TOKEN" ? "t0k" : "") } };

describe("pos-sync handlePosSyncRequest", () => {
  beforeEach(() => {
    decryptMock = vi.fn();
  });

  it("skips when no credentials", async () => {
    const { handlePosSyncRequest } = await import("../../supabase/functions/pos-sync/index.ts");
    const svc = svcFactory({ credRow: null });
    const res = await handlePosSyncRequest(
      makeReq({ clientId: uuidA, locationId: uuidB, provider: "bistrosoft", range: { from: "2025-01-01", to: "2025-01-01" }, dryRun: true }),
      { svc, kmsHex: kms() }
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe("no_credentials");
    expect((svc as any).__state.invokes.length).toBe(0);
  });

  it("skips when status invalid", async () => {
    const { handlePosSyncRequest } = await import("../../supabase/functions/pos-sync/index.ts");
    const svc = svcFactory({ credRow: { status: "invalid", ciphertext: "{}" } });
    const res = await handlePosSyncRequest(makeReq({ clientId: uuidA, locationId: uuidB, provider: "bistrosoft" }), { svc, kmsHex: kms() });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reason).toBe("invalid_credentials");
    expect((svc as any).__state.invokes.length).toBe(0);
  });

  it("skips on backoff", async () => {
    const { handlePosSyncRequest } = await import("../../supabase/functions/pos-sync/index.ts");
    decryptMock.mockResolvedValue({ apiKey: "bs_ok" });
    const future = new Date(Date.now() + 60_000).toISOString();
    const svc = svcFactory({ credRow: { status: "connected", ciphertext: "{}" }, syncStatus: { next_attempt_at: future } });
    const res = await handlePosSyncRequest(makeReq({ clientId: uuidA, locationId: uuidB, provider: "bistrosoft" }), { svc, kmsHex: kms() });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reason).toBe("backoff");
    expect((svc as any).__state.invokes.length).toBe(0);
  });

  it("ciphertext invalid → 500", async () => {
    const { handlePosSyncRequest } = await import("../../supabase/functions/pos-sync/index.ts");
    decryptMock.mockRejectedValue(new Error("bad"));
    const svc = svcFactory({ credRow: { status: "connected", ciphertext: "{}" } });
    const res = await handlePosSyncRequest(makeReq({ clientId: uuidA, locationId: uuidB, provider: "bistrosoft" }), { svc, kmsHex: kms() });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe("ciphertext_invalid");
  });

  it("pre-validation fails (401/403-like) → mark invalid & skip", async () => {
    const { handlePosSyncRequest } = await import("../../supabase/functions/pos-sync/index.ts");
    decryptMock.mockResolvedValue({ apiKey: "bad" });
    const svc = svcFactory({ credRow: { status: "connected", ciphertext: "{}" } });
    const res = await handlePosSyncRequest(makeReq({ clientId: uuidA, locationId: uuidB, provider: "bistrosoft" }), { svc, kmsHex: kms() });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reason).toBe("invalid_credentials");
    expect((svc as any).__state.updates.length).toBeGreaterThan(0);
    expect((svc as any).__state.invokes.length).toBe(0);
  });

  it("happy path → run created and success logged", async () => {
    const { handlePosSyncRequest } = await import("../../supabase/functions/pos-sync/index.ts");
    decryptMock.mockResolvedValue({ apiKey: "bs_ok" });
    const svc = svcFactory({ credRow: { status: "connected", ciphertext: "{}" } });
    const res = await handlePosSyncRequest(
      makeReq({ clientId: uuidA, locationId: uuidB, provider: "bistrosoft", range: { from: "2025-01-01", to: "2025-01-01" }, dryRun: true }),
      { svc, kmsHex: kms() }
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.runId).toBe("run_test");
    const inv = (svc as any).__state.invokes;
    expect(inv.find((x: any) => x.body?.action === "start")).toBeTruthy();
    expect(inv.find((x: any) => x.body?.action === "success")).toBeTruthy();
  });

  it("unexpected error during sync → 500 and error logged", async () => {
    const { handlePosSyncRequest } = await import("../../supabase/functions/pos-sync/index.ts");
    decryptMock.mockResolvedValue({ apiKey: "bs_ok" });
    const svc = svcFactory({ credRow: { status: "connected", ciphertext: "{}" }, rpcError: true });
    const res = await handlePosSyncRequest(
      makeReq({ clientId: uuidA, locationId: uuidB, provider: "bistrosoft", range: { from: "2025-01-01", to: "2025-01-01" }, dryRun: false }),
      { svc, kmsHex: kms() }
    );
    expect(res.status).toBe(500);
    const inv = (svc as any).__state.invokes;
    expect(inv.find((x: any) => x.body?.action === "error")).toBeTruthy();
  });
});
