import { vi } from "vitest";

export const createCryptoMocks = () => {
  const mockRandomUUID = vi.fn();
  const mockImportKey = vi.fn();
  const mockSign = vi.fn();

  // Setup default return values - fixed for determinism
  mockRandomUUID.mockReturnValue("rotation-id-12345");
  
  mockImportKey.mockResolvedValue({} as CryptoKey);
  
  // Mock HMAC signature for token fingerprint
  const mockSignature = new Uint8Array([
    0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x90,
    0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x11, 0x22
  ]);
  mockSign.mockResolvedValue(mockSignature.buffer);

  const originalCrypto = global.crypto;

  const cryptoMock = {
    ...originalCrypto,
    randomUUID: mockRandomUUID,
    subtle: {
      ...originalCrypto.subtle,
      importKey: mockImportKey,
      sign: mockSign,
    },
  };

  return {
    mockRandomUUID,
    mockImportKey,
    mockSign,
    activate: () => {
      Object.defineProperty(global, 'crypto', {
        value: cryptoMock,
        writable: true,
      });
    },
    restore: () => {
      Object.defineProperty(global, 'crypto', {
        value: originalCrypto,
        writable: true,
      });
    },
    resetMocks: () => {
      mockRandomUUID.mockClear();
      mockImportKey.mockClear();
      mockSign.mockClear();
    },
  };
};

export const createDenoEnvMock = () => {
  const originalEnv = (global as any).Deno?.env;
  
  const mockEnv = {
    get: vi.fn((key: string) => {
      const envVars: Record<string, string> = {
        SUPABASE_URL: "https://test.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      };
      return envVars[key];
    }),
  };

  return {
    mockEnvGet: mockEnv.get,
    activate: () => {
      Object.defineProperty(global, 'Deno', {
        value: { env: mockEnv },
        writable: true,
      });
    },
    restore: () => {
      if (originalEnv) {
        Object.defineProperty(global, 'Deno', {
          value: { env: originalEnv },
          writable: true,
        });
      }
    },
  };
};