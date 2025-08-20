import { vi } from "vitest";

export interface MockFudoTokenResponse {
  access_token: string;
  expires_in: number;
}

export interface MockFudoMeResponse {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export const createFudoApiMocks = () => {
  const originalFetch = global.fetch;
  
  const mockFetch = vi.fn() as any;
  
  const mockSuccessfulTokenResponse = (): MockFudoTokenResponse => ({
    access_token: "new_fudo_token_12345",
    expires_in: 3600,
  });

  const mockSuccessfulMeResponse = (): MockFudoMeResponse => ({
    user: {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
    },
  });

  const mockTokenError = (status: number, message = "Authentication failed") => ({
    ok: false,
    status,
    text: async () => message,
  });

  const mockValidationError = (status: number, message = "Token validation failed") => ({
    ok: false,
    status,
    text: async () => message,
  });

  const setupSuccessfulFlow = () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSuccessfulTokenResponse(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSuccessfulMeResponse(),
      });
  };

  const setupTokenFailure = (status: number = 401) => {
    mockFetch.mockResolvedValueOnce(mockTokenError(status));
  };

  const setupValidationFailure = (status: number = 401) => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSuccessfulTokenResponse(),
      })
      .mockResolvedValueOnce(mockValidationError(status));
  };

  const setup5xxError = (status: number = 500) => {
    mockFetch.mockResolvedValueOnce(mockTokenError(status, "Internal server error"));
  };

  const setupNetworkError = () => {
    mockFetch.mockRejectedValueOnce(new Error("Network timeout"));
  };

  return {
    mockFetch,
    setupSuccessfulFlow,
    setupTokenFailure,
    setupValidationFailure,
    setup5xxError,
    setupNetworkError,
    mockSuccessfulTokenResponse,
    mockSuccessfulMeResponse,
    restore: () => {
      global.fetch = originalFetch;
    },
    activate: () => {
      global.fetch = mockFetch;
    },
  };
};