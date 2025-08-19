import type { POSConfig } from "../../../../sdk/pos";
import type { FudoClient, FudoFetchSalesParams, FudoFetchSalesResponse } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { fudoMetrics } from "./metrics";

// Error types for 401 handling
interface FudoError extends Error {
  status?: number;
  code?: string;
  response?: {
    status: number;
    statusText: string;
    data?: any;
  };
}

// In-flight refresh deduplication per location
const inFlightRefreshes = new Map<string, Promise<void>>();

export class DefaultFudoClient implements FudoClient {
  constructor(private readonly cfg: POSConfig) {}

  async validate(): Promise<boolean> {
    return this.callWithRetry(async () => {
      // Dummy validation for now (no network hit)
      return Boolean(this.cfg.apiKey);
    }, { operation: 'validate' });
  }

  async fetchSales(params: FudoFetchSalesParams): Promise<FudoFetchSalesResponse> {
    return this.callWithRetry(async () => {
      // Placeholder: real implementation would call Fudo API with pagination
      // For now, simulate API call behavior
      if (Math.random() < 0.1) {
        // Simulate 401 error 10% of the time for testing
        const error: FudoError = new Error('Token expired');
        error.status = 401;
        error.code = 'TOKEN_EXPIRED';
        error.response = { status: 401, statusText: 'Unauthorized' };
        throw error;
      }
      return { data: [], nextCursor: undefined };
    }, { operation: 'fetchSales', params });
  }

  /**
   * Core interceptor with retry logic and deduplication
   */
  private async callWithRetry<T>(
    operation: () => Promise<T>,
    context: { operation: string; params?: any; didRetry?: boolean }
  ): Promise<T> {
    const locationId = this.cfg.locationId;
    
    try {
      return await operation();
    } catch (err: any) {
      const fudoError = err as FudoError;
      
      // Only retry once per request
      if (!context.didRetry && this.isExpired401(fudoError)) {
        await fudoMetrics.increment('fudo.401_total', {
          location_id: locationId,
          operation: context.operation
        });

        if (!locationId) {
          throw this.wrapFudoError(fudoError, 'No location ID available for token rotation');
        }

        // Check circuit breaker before attempting rotation
        const canRotate = await this.checkCircuitBreaker(locationId);
        if (!canRotate) {
          await fudoMetrics.increment('fudo.401_failed_circuit_open', {
            location_id: locationId,
            operation: context.operation
          });
          throw this.wrapFudoError(fudoError, 'Circuit breaker open, rotation blocked');
        }

        // Deduplicate concurrent rotations for same location
        let refreshPromise = inFlightRefreshes.get(locationId);
        if (!refreshPromise) {
          refreshPromise = this.rotateOnDemand(locationId)
            .finally(() => {
              inFlightRefreshes.delete(locationId);
            });
          inFlightRefreshes.set(locationId, refreshPromise);
        }

        try {
          await refreshPromise;
          await fudoMetrics.increment('fudo.401_recovered_attempt', {
            location_id: locationId,
            operation: context.operation
          });

          // Retry the original operation once
          return await this.callWithRetry(operation, {
            ...context,
            didRetry: true
          });
        } catch (rotationError) {
          await fudoMetrics.increment('fudo.rotate_ondemand_failed', {
            location_id: locationId,
            error: (rotationError as Error).message
          });
          throw this.wrapFudoError(fudoError, 'Token rotation failed');
        }
      }

      // Log failed retry or non-401 errors
      if (context.didRetry) {
        await fudoMetrics.increment('fudo.401_failed_after_retry', {
          location_id: locationId,
          operation: context.operation,
          error_status: fudoError.status,
          error_code: fudoError.code
        });
      }

      throw this.wrapFudoError(fudoError);
    }
  }

  /**
   * Detect if error is due to expired token (401 with specific indicators)
   */
  private isExpired401(error: FudoError): boolean {
    if (error.status !== 401 && error.response?.status !== 401) {
      return false;
    }

    // Check for token expiration indicators
    const expiredIndicators = [
      'token_expired',
      'expired',
      'invalid_token',
      'unauthorized',
      'jwt_expired'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code?.toLowerCase() || '';
    
    return expiredIndicators.some(indicator => 
      errorMessage.includes(indicator) || errorCode.includes(indicator)
    );
  }

  /**
   * Check circuit breaker status for location before attempting rotation
   */
  private async checkCircuitBreaker(locationId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('cb_check_state', {
        _provider: 'fudo',
        _location_id: locationId
      });

      if (error) {
        console.error('Circuit breaker check failed:', error);
        return false; // Fail safe
      }

      // Handle different possible return types from RPC
      if (typeof data === 'object' && data !== null) {
        return (data as any).allowed === true;
      }
      
      return false; // Fail safe if data format is unexpected
    } catch (error) {
      console.error('Circuit breaker check error:', error);
      return false; // Fail safe
    }
  }

  /**
   * Perform on-demand token rotation using existing atomic rotation RPC
   */
  private async rotateOnDemand(locationId: string): Promise<void> {
    const rotationId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      await fudoMetrics.increment('fudo.rotate_ondemand_attempt', {
        location_id: locationId,
        rotation_id: rotationId
      });

      // Generate new token (placeholder - real implementation would call Fudo API)
      const newTokenEncrypted = await this.generateNewToken();

      // Use existing atomic rotation RPC
      const { data, error } = await supabase.rpc('execute_atomic_rotation', {
        p_location_id: locationId,
        p_provider: 'fudo',
        p_rotation_id: rotationId,
        p_new_token_encrypted: newTokenEncrypted,
        p_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      });

      if (error) {
        throw new Error(`Atomic rotation failed: ${error.message}`);
      }

      const duration = Date.now() - startTime;
      const isIdempotent = data?.[0]?.is_idempotent === true;

      await fudoMetrics.increment('fudo.rotate_ondemand_success', {
        location_id: locationId,
        rotation_id: rotationId,
        duration_ms: duration,
        idempotent: isIdempotent
      });

      // Update local config with new token (in real implementation)
      // this.cfg.apiKey = newToken;

    } catch (error) {
      const duration = Date.now() - startTime;
      await fudoMetrics.increment('fudo.rotate_ondemand_failed', {
        location_id: locationId,
        rotation_id: rotationId,
        duration_ms: duration,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Generate new token (placeholder for real Fudo API integration)
   */
  private async generateNewToken(): Promise<string> {
    // Placeholder: real implementation would call Fudo API to refresh token
    // For now, return a dummy encrypted token
    return `encrypted_token_${Date.now()}_${Math.random()}`;
  }

  /**
   * Wrap Fudo errors with clear messaging and context
   */
  private wrapFudoError(originalError: FudoError, additionalContext?: string): Error {
    const locationId = this.cfg.locationId;
    
    if (originalError.status === 401) {
      const message = additionalContext || 'Authentication failed - token may be expired or invalid';
      const wrappedError = new Error(`Fudo API Error: ${message}`);
      (wrappedError as any).originalError = originalError;
      (wrappedError as any).locationId = locationId;
      return wrappedError;
    }

    if (originalError.status === 403) {
      const wrappedError = new Error('Fudo API Error: Insufficient permissions for this operation');
      (wrappedError as any).originalError = originalError;
      (wrappedError as any).locationId = locationId;
      return wrappedError;
    }

    // For other errors, preserve original message
    const wrappedError = new Error(`Fudo API Error: ${originalError.message}`);
    (wrappedError as any).originalError = originalError;
    (wrappedError as any).locationId = locationId;
    return wrappedError;
  }
}
