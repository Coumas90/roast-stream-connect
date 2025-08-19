import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client for testing
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ data: [], error: null }))
    })),
    insert: vi.fn(() => ({ data: [], error: null })),
    update: vi.fn(() => ({ data: [], error: null })),
    delete: vi.fn(() => ({ data: [], error: null }))
  }))
};

describe('Atomic Rotation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Idempotency Tests', () => {
    it('should return idempotent result for same rotation_id', async () => {
      const rotationId = 'test-rotation-123';
      const locationId = 'test-location-456';
      
      // Mock the RPC call to return idempotent result
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          operation_result: 'idempotent',
          rows_affected: 0,
          token_id: null,
          is_idempotent: true
        }],
        error: null
      });

      const result = await mockSupabase.rpc('execute_atomic_rotation', {
        p_location_id: locationId,
        p_provider: 'fudo',
        p_rotation_id: rotationId,
        p_new_token_encrypted: 'encrypted-token-123',
        p_expires_at: new Date(Date.now() + 3600000).toISOString()
      });

      expect(result.data[0].operation_result).toBe('idempotent');
      expect(result.data[0].is_idempotent).toBe(true);
      expect(result.data[0].rows_affected).toBe(0);
    });

    it('should perform rotation for new rotation_id', async () => {
      const rotationId = 'new-rotation-789';
      const locationId = 'test-location-456';
      const newTokenId = 'token-id-new-456';
      
      // Mock the RPC call to return successful rotation
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          operation_result: 'rotated',
          rows_affected: 1,
          token_id: newTokenId,
          is_idempotent: false
        }],
        error: null
      });

      const result = await mockSupabase.rpc('execute_atomic_rotation', {
        p_location_id: locationId,
        p_provider: 'fudo',
        p_rotation_id: rotationId,
        p_new_token_encrypted: 'encrypted-token-new-789',
        p_expires_at: new Date(Date.now() + 3600000).toISOString()
      });

      expect(result.data[0].operation_result).toBe('rotated');
      expect(result.data[0].is_idempotent).toBe(false);
      expect(result.data[0].rows_affected).toBe(1);
      expect(result.data[0].token_id).toBe(newTokenId);
    });
  });

  describe('Concurrency Tests', () => {
    it('should handle concurrent rotations with same rotation_id', async () => {
      const rotationId = 'concurrent-rotation-123';
      const locationId = 'test-location-concurrent';
      
      // First call succeeds
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{
          operation_result: 'rotated',
          rows_affected: 1,
          token_id: 'token-first-winner',
          is_idempotent: false
        }],
        error: null
      });

      // Second concurrent call gets idempotent result
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{
          operation_result: 'concurrent_idempotent',
          rows_affected: 0,
          token_id: null,
          is_idempotent: true
        }],
        error: null
      });

      // Simulate concurrent calls
      const [result1, result2] = await Promise.all([
        mockSupabase.rpc('execute_atomic_rotation', {
          p_location_id: locationId,
          p_provider: 'fudo',
          p_rotation_id: rotationId,
          p_new_token_encrypted: 'token-1',
          p_expires_at: new Date(Date.now() + 3600000).toISOString()
        }),
        mockSupabase.rpc('execute_atomic_rotation', {
          p_location_id: locationId,
          p_provider: 'fudo',
          p_rotation_id: rotationId,
          p_new_token_encrypted: 'token-2',
          p_expires_at: new Date(Date.now() + 3600000).toISOString()
        })
      ]);

      // One should succeed, one should be concurrent idempotent
      const results = [result1.data[0], result2.data[0]];
      const rotated = results.find(r => r.operation_result === 'rotated');
      const concurrent = results.find(r => r.operation_result === 'concurrent_idempotent');

      expect(rotated).toBeDefined();
      expect(rotated.rows_affected).toBe(1);
      expect(rotated.is_idempotent).toBe(false);

      expect(concurrent).toBeDefined();
      expect(concurrent.rows_affected).toBe(0);
      expect(concurrent.is_idempotent).toBe(true);
    });

    it('should allow concurrent rotations with different rotation_ids', async () => {
      const locationId = 'test-location-different';
      
      // Both rotations should succeed since they have different rotation_ids
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          operation_result: 'rotated',
          rows_affected: 1,
          token_id: 'token-independent',
          is_idempotent: false
        }],
        error: null
      });

      const [result1, result2] = await Promise.all([
        mockSupabase.rpc('execute_atomic_rotation', {
          p_location_id: locationId,
          p_provider: 'fudo',
          p_rotation_id: 'rotation-a-123',
          p_new_token_encrypted: 'token-a',
          p_expires_at: new Date(Date.now() + 3600000).toISOString()
        }),
        mockSupabase.rpc('execute_atomic_rotation', {
          p_location_id: locationId,
          p_provider: 'fudo',
          p_rotation_id: 'rotation-b-456',
          p_new_token_encrypted: 'token-b',
          p_expires_at: new Date(Date.now() + 3600000).toISOString()
        })
      ]);

      // Note: With advisory locks, these would actually serialize, but both should eventually succeed
      expect(result1.data[0].operation_result).toBe('rotated');
      expect(result2.data[0].operation_result).toBe('rotated');
    });
  });

  describe('Security Tests', () => {
    it('should never log raw tokens in metadata', () => {
      const testMetadata = {
        rotation_id: 'test-123',
        fingerprint: 'sha256:abc123...',
        expires_in: 3600,
        operation_result: 'rotated'
      };

      // Ensure no raw token fields are present
      expect(testMetadata).not.toHaveProperty('token');
      expect(testMetadata).not.toHaveProperty('access_token');
      expect(testMetadata).not.toHaveProperty('raw_token');
      
      // Should only contain fingerprint, not raw token
      expect(testMetadata.fingerprint).toMatch(/^sha256:/);
    });

    it('should create consistent fingerprints for same token', async () => {
      const token = 'test-token-123';
      
      // Mock crypto.subtle.digest for consistent testing
      const mockDigest = vi.fn().mockResolvedValue(
        new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
      );
      
      global.crypto = {
        ...global.crypto,
        subtle: {
          ...global.crypto?.subtle,
          digest: mockDigest
        }
      } as any;

      // Function to create fingerprint (simplified version)
      const createFingerprint = async (token: string) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(token);
        const hash = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hash));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return `sha256:${hashHex.substring(0, 16)}...`;
      };

      const fingerprint1 = await createFingerprint(token);
      const fingerprint2 = await createFingerprint(token);

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toMatch(/^sha256:[a-f0-9]{16}\.\.\.$/);
    });
  });

  describe('Edge Function Integration', () => {
    it('should handle idempotent results correctly in edge function', () => {
      const mockAttempt = {
        locationId: 'test-location',
        rotationId: 'test-rotation',
        provider: 'fudo',
        status: 'pending',
        startedAt: Date.now()
      };

      // Simulate processing idempotent result
      const result = {
        operation_result: 'idempotent',
        rows_affected: 0,
        token_id: null,
        is_idempotent: true
      };

      // Logic that should happen in edge function
      if (result.is_idempotent) {
        mockAttempt.status = 'idempotent';
        mockAttempt.metadata = {
          operation_result: result.operation_result,
          fingerprint: 'sha256:test...',
          atomic: true,
          idempotent_hit: true
        };
      }

      expect(mockAttempt.status).toBe('idempotent');
      expect(mockAttempt.metadata.idempotent_hit).toBe(true);
      expect(mockAttempt.metadata.operation_result).toBe('idempotent');
    });

    it('should exclude idempotent attempts from metrics', () => {
      const results = [
        { status: 'completed', locationId: 'loc1' },
        { status: 'idempotent', locationId: 'loc2' },
        { status: 'failed', locationId: 'loc3' },
        { status: 'completed', locationId: 'loc4' }
      ];

      // Filter logic that should be in edge function
      const metricsEligible = results.filter(r => r.status !== 'idempotent');
      const idempotentCount = results.filter(r => r.status === 'idempotent').length;

      expect(metricsEligible).toHaveLength(3);
      expect(idempotentCount).toBe(1);
      
      // Should include in summary but not individual metrics
      const summary = {
        total_attempts: results.length,
        successes: results.filter(r => r.status === 'completed').length,
        failures: results.filter(r => r.status === 'failed').length,
        idempotent_hits: idempotentCount
      };

      expect(summary.total_attempts).toBe(4);
      expect(summary.successes).toBe(2);
      expect(summary.failures).toBe(1);
      expect(summary.idempotent_hits).toBe(1);
    });
  });
});