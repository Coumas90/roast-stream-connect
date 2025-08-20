import { vi } from "vitest";

export const createSupabaseMock = () => {
  const rpcMock = vi.fn();
  const fromMock = vi.fn();
  const updateMock = vi.fn();
  const selectMock = vi.fn();

  const supabaseMock = {
    rpc: rpcMock,
    from: vi.fn(() => ({
      update: updateMock,
      select: selectMock,
    })),
  };

  return {
    supabaseMock,
    rpcMock,
    fromMock,
    updateMock,
    selectMock,
    resetMocks: () => {
      rpcMock.mockReset();
      fromMock.mockReset();
      updateMock.mockReset();
      selectMock.mockReset();
    }
  };
};

export const mockCircuitBreakerState = (state: "closed" | "open" | "half-open", allowed = true, testMode = false) => ({
  state,
  allowed,
  test_mode: testMode,
  failure_count: state === "open" ? 10 : 0,
  resume_at: state === "open" ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null,
});

export const mockLeasedCredentials = (count = 3) => 
  Array.from({ length: count }, (_, i) => ({
    location_id: `location-${i + 1}`,
    secret_ref: `pos/location/${i + 1}/fudo/encrypted_data_${i + 1}`,
    last_rotated: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
  }));

export const mockAtomicRotationSuccess = (isIdempotent = false) => ({
  data: [{
    operation_result: isIdempotent ? "no_change_needed" : "token_updated",
    rows_affected: isIdempotent ? 0 : 1,
    token_id: "token-12345",
    is_idempotent: isIdempotent,
  }],
  error: null,
});

export const mockAtomicRotationError = (message = "Database constraint violation") => ({
  data: null,
  error: { message },
});