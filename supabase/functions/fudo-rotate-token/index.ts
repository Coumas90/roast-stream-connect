import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";
import { withCORS } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface FudoTokenResponse {
  access_token: string;
  expires_in: number;
}

interface FudoMeResponse {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

interface ErrorClassification {
  category: 'network' | 'rate_limited' | '5xx' | 'invalid_credentials' | 'client_error' | 'ok';
  shouldIncrementBreaker: boolean;
}

interface RotationAttempt {
  locationId: string;
  rotationId: string;
  provider: string;
  status: 'pending' | 'completed' | 'failed' | 'idempotent';
  startedAt: number;
  completedAt?: number;
  error?: string;
  metadata?: any;
}

interface RotationResult {
  total_candidates: number;
  processed: number;
  successes: number;
  failures: number;
  idempotent_hits: number;
  circuit_breaker_blocked: number;
  attempts: RotationAttempt[];
}

// Helper functions
function classifyError(status?: number, err?: Error): ErrorClassification {
  if (!status) {
    return { category: 'network', shouldIncrementBreaker: true };
  }
  
  if (status === 429) {
    return { category: 'rate_limited', shouldIncrementBreaker: true };
  }
  
  if (status >= 500) {
    return { category: '5xx', shouldIncrementBreaker: true };
  }
  
  if (status === 401 || status === 403 || status === 422) {
    return { category: 'invalid_credentials', shouldIncrementBreaker: false };
  }
  
  if (status >= 400) {
    return { category: 'client_error', shouldIncrementBreaker: false };
  }
  
  return { category: 'ok', shouldIncrementBreaker: false };
}

async function createTokenFingerprint(token: string): Promise<string> {
  try {
    // Create a truncated HMAC for logging (first 16 chars)
    const encoder = new TextEncoder();
    const key = encoder.encode('fudo-token-fingerprint-key');
    const data = encoder.encode(token);
    
    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
    const hex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `sha256:${hex.substring(0, 16)}...`;
  } catch {
    return 'sha256:unknown...';
  }
}

async function fudoGetToken(credentials: { apiKey: string; apiSecret: string; env: string }): Promise<FudoTokenResponse> {
  const baseUrl = credentials.env === "production" ? "https://api.fudo.com" : "https://staging-api.fudo.com";
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
  
  try {
    const response = await fetch(`${baseUrl}/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: credentials.apiKey,
        api_secret: credentials.apiSecret,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      const classification = classifyError(response.status);
      throw new Error(`Token request failed: ${response.status} ${error} (${classification.category})`);
    }

    return await response.json() as FudoTokenResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fudoValidateToken(token: string, env: string): Promise<FudoMeResponse> {
  const baseUrl = env === "production" ? "https://api.fudo.com" : "https://staging-api.fudo.com";
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
  try {
    const response = await fetch(`${baseUrl}/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      const classification = classifyError(response.status);
      throw new Error(`Token validation failed: ${response.status} ${error} (${classification.category})`);
    }

    return await response.json() as FudoMeResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function decryptSecretRef(secretRef: string): Promise<{ apiKey: string; apiSecret: string; env: string }> {
  // In a real implementation, this would decrypt using KMS
  // For now, return mock credentials for development
  console.log(`[SECURITY] Accessing encrypted secret: ${secretRef.substring(0, 20)}...`);
  
  return {
    apiKey: "mock_api_key",
    apiSecret: "mock_api_secret", 
    env: "staging"
  };
}

async function rotateTokenForLocation(locationId: string, secretRef: string): Promise<RotationAttempt> {
  const rotationId = crypto.randomUUID();
  const attempt: RotationAttempt = {
    locationId,
    rotationId,
    provider: "fudo",
    status: "pending",
    startedAt: Date.now(),
  };

  try {
    // Step 1: Decrypt credentials
    const credentials = await decryptSecretRef(secretRef);
    
    // Step 2: Get new token from Fudo API
    const tokenResponse = await fudoGetToken(credentials);
    if (!tokenResponse.access_token) {
      throw new Error("No access token received from Fudo API");
    }

    // Step 3: Validate new token (outside of transaction)
    await fudoValidateToken(tokenResponse.access_token, credentials.env);

    // Step 4: Create token fingerprint for logging (never log raw token)
    const fingerprint = await createTokenFingerprint(tokenResponse.access_token);

    // Step 5: Execute atomic rotation via stored procedure
    const { data: rotationResult, error: rotationError } = await supabase.rpc(
      'execute_atomic_rotation',
      {
        p_location_id: locationId,
        p_provider: 'fudo',
        p_rotation_id: rotationId,
        p_new_token_encrypted: tokenResponse.access_token,
        p_expires_at: tokenResponse.expires_in 
          ? new Date(Date.now() + (tokenResponse.expires_in * 1000)).toISOString()
          : null
      }
    );

    if (rotationError) {
      throw new Error(`Atomic rotation failed: ${rotationError.message}`);
    }

    const result = rotationResult[0];
    const isIdempotent = result.is_idempotent;
    
    // Don't duplicate metrics/logs if this was an idempotent retry
    if (!isIdempotent) {
      attempt.status = "completed";
      attempt.metadata = { 
        operation_result: result.operation_result,
        rows_affected: result.rows_affected,
        token_id: result.token_id,
        fingerprint,
        expires_in: tokenResponse.expires_in || 3600,
        atomic: true
      };
      console.log(`✅ Token rotated successfully for location ${locationId}, operation: ${result.operation_result}, fingerprint: ${fingerprint}`);
    } else {
      attempt.status = "idempotent";
      attempt.metadata = { 
        operation_result: result.operation_result,
        fingerprint,
        atomic: true,
        idempotent_hit: true
      };
      console.log(`🔄 Idempotent rotation detected for location ${locationId}, rotation_id: ${rotationId}`);
    }
    
    attempt.completedAt = Date.now();

  } catch (error) {
    attempt.status = "failed";
    attempt.error = error instanceof Error ? error.message : String(error);
    attempt.completedAt = Date.now();
    console.error(`❌ Token rotation failed for location ${locationId}:`, error);
  }

  return attempt;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  // Heartbeat helper with jitter to maintain lease locks
  let shouldStop = false;
  let renewFails = 0;
  const jitter = () => 15 + Math.floor(Math.random() * 30); // 15-45s jitter
  
  const startHeartbeat = (lockName: string, holder: string, ttlSeconds: number) => {
    const intervalMs = (ttlSeconds * 500) + jitter() * 1000; // ~TTL*0.5 + jitter
    return setInterval(async () => {
      if (shouldStop) return;
      
      const { data: renewed, error } = await supabase.rpc("renew_job_lock", {
        p_name: lockName,
        p_holder: holder,
        p_ttl_seconds: ttlSeconds
      });
      
      renewFails = renewed && !error ? 0 : renewFails + 1;
      if (renewFails >= 2) {
        console.warn(`[HEARTBEAT] Failed to renew lock ${renewFails} times, marking for graceful shutdown`);
        shouldStop = true;
      }
    }, intervalMs);
  };

  try {
    const startTime = Date.now();
    console.log("[START] Fudo token rotation job initiated");

    // Check global circuit breaker state for Fudo provider
    const { data: globalCbState, error: cbError } = await supabase.rpc("cb_check_state", { 
      _provider: "fudo",
      _location_id: null // Global check
    });

    if (cbError) {
      console.error("[ERROR] Failed to check global circuit breaker state:", cbError);
      throw new Error(`Circuit breaker check failed: ${cbError.message}`);
    }

    console.log(`[CB GLOBAL] Circuit breaker state: ${JSON.stringify(globalCbState)}`);

    if (!globalCbState.allowed) {
      console.warn(`[CB GLOBAL] Global circuit breaker is ${globalCbState.state}, skipping rotation`);
      return new Response(JSON.stringify({
        success: false,
        message: `Global circuit breaker is ${globalCbState.state}`,
        circuit_breaker: globalCbState,
        resume_at: globalCbState.resume_at
      }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Atomic leasing: select eligible candidates and mark attempts in one operation
    const { data: leasedCreds, error: leaseError } = await supabase.rpc("lease_fudo_rotation_candidates", {
      p_limit: 50,
      p_cooldown: "4 hours"
    });

    if (leaseError) {
      console.error("[ERROR] Failed to lease rotation candidates:", leaseError);
      throw new Error(`Failed to lease candidates: ${leaseError.message}`);
    }

    const result: RotationResult = {
      total_candidates: leasedCreds?.length || 0,
      processed: 0,
      successes: 0,
      failures: 0,
      idempotent_hits: 0,
      circuit_breaker_blocked: 0,
      attempts: []
    };

    console.log(`[INFO] Leased ${result.total_candidates} Fudo credentials for rotation (max 50 per run, 4h cooldown, circuit breaker aware)`);

    if (result.total_candidates === 0) {
      console.log("[INFO] No credentials need rotation at this time (respecting cooldown, limits, and circuit breaker)");
      return new Response(JSON.stringify({
        success: true,
        message: "No credentials need rotation (respecting cooldown, limits, and circuit breaker)",
        result
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // For half-open circuit breaker, test with only 1 location
    const locationsToProcess = globalCbState.test_mode ? 
      leasedCreds.slice(0, 1) : leasedCreds;

    if (globalCbState.test_mode) {
      console.log("[CB] Half-open mode: testing with 1 location only");
    }

    // Process each leased location (attempt already marked atomically)
    for (const cred of locationsToProcess) {
      // Check if we should stop due to heartbeat failure
      if (shouldStop) {
        console.warn(`[HEARTBEAT] Stopping rotation due to heartbeat failure`);
        result.circuit_breaker_blocked = locationsToProcess.length - result.processed;
        break;
      }

      result.processed++;
      
      // Check location-specific circuit breaker state
      const { data: locationCbState } = await supabase.rpc("cb_check_state", { 
        _provider: "fudo",
        _location_id: cred.location_id
      });

      if (locationCbState && !locationCbState.allowed) {
        console.warn(`[CB LOCATION] Location ${cred.location_id} circuit breaker is ${locationCbState.state}, skipping`);
        result.circuit_breaker_blocked++;
        continue;
      }

      console.log(`[LEASE] Processing leased location ${cred.location_id} (attempt already marked atomically)`);

      const attempt = await rotateTokenForLocation(cred.location_id, cred.secret_ref);
      result.attempts.push(attempt);
      
      if (attempt.status === "completed") {
        result.successes++;
        
        // Record success with both global and location-specific circuit breakers
        await supabase.rpc("cb_record_success", { 
          _provider: "fudo",
          _location_id: null // Global
        });
        await supabase.rpc("cb_record_success", { 
          _provider: "fudo", 
          _location_id: cred.location_id // Location-specific
        });
        
      } else if (attempt.status === "idempotent") {
        result.idempotent_hits++;
        // Don't update circuit breaker for idempotent hits
        
      } else if (attempt.status === "failed") {
        result.failures++;
        
        // Only increment circuit breaker for network/5xx/rate limit errors, not auth failures
        const classification = classifyError(
          attempt.error?.match(/(\d{3})/)?.[1] ? parseInt(attempt.error.match(/(\d{3})/)[1]) : undefined
        );
        
        if (classification.shouldIncrementBreaker) {
          // Record failure with both global and location-specific circuit breakers
          const { data: globalCbResult } = await supabase.rpc("cb_record_failure", { 
            _provider: "fudo",
            _location_id: null // Global
          });
          await supabase.rpc("cb_record_failure", { 
            _provider: "fudo", 
            _location_id: cred.location_id // Location-specific
          });
          
          if (globalCbResult?.state === 'open') {
            console.warn("[CB GLOBAL] Global circuit breaker opened due to failures, stopping rotation");
            result.circuit_breaker_blocked = locationsToProcess.length - result.processed;
            break;
          }
          console.log(`[CB] Circuit breaker failure recorded for location ${cred.location_id}, category: ${classification.category}`);
        } else {
          console.log(`[CB] Auth/client error for location ${cred.location_id}, not counting towards circuit breaker, category: ${classification.category}`);
        }
      }
    }

    const duration = Date.now() - startTime;
    
    console.log(`[COMPLETE] Rotation job finished in ${duration}ms`);
    console.log(`[STATS] ${result.successes} successes, ${result.failures} failures, ${result.idempotent_hits} idempotent, ${result.circuit_breaker_blocked} blocked`);

    // Record detailed metrics for this job run
    const jobRunId = crypto.randomUUID();
    
    // Job-level summary metrics
    await supabase.rpc("record_rotation_metric", {
      p_job_run_id: jobRunId,
      p_provider: "fudo",
      p_metric_type: "job_summary",
      p_value: result.processed,
      p_duration_ms: duration,
      p_meta: {
        total_candidates: result.total_candidates,
        successes: result.successes,
        failures: result.failures,
        idempotent_hits: result.idempotent_hits,
        circuit_breaker_blocked: result.circuit_breaker_blocked,
        trigger: "cron",
        timestamp: new Date().toISOString()
      }
    });

    // Individual attempt metrics (exclude idempotent to avoid metric duplication)
    for (const attempt of result.attempts) {
      if (attempt.status !== 'idempotent') {
        await supabase.rpc("record_rotation_metric", {
          p_job_run_id: jobRunId,
          p_provider: "fudo",
          p_location_id: attempt.locationId,
          p_metric_type: "rotation_attempt",
          p_value: attempt.status === 'completed' ? 1 : 0,
          p_duration_ms: attempt.completedAt ? attempt.completedAt - attempt.startedAt : null,
          p_meta: {
            rotation_id: attempt.rotationId,
            status: attempt.status,
            error: attempt.error,
            ...attempt.metadata
          }
        });
      }
    }

    // Record heartbeat on successful completion
    if (result.successes > 0 || result.total_candidates === 0) {
      await supabase.rpc('update_job_heartbeat', {
        p_job_name: 'fudo_rotate_token',
        p_status: 'healthy',
        p_metadata: {
          last_execution: new Date().toISOString(),
          total_candidates: result.total_candidates,
          successes: result.successes,
          failures: result.failures,
          idempotent_hits: result.idempotent_hits,
          duration_ms: duration,
          job_run_id: jobRunId
        }
      });
      console.log('[HEARTBEAT] Recorded healthy heartbeat for fudo_rotate_token');
    } else {
      // Record unhealthy if all failed
      await supabase.rpc('update_job_heartbeat', {
        p_job_name: 'fudo_rotate_token', 
        p_status: 'unhealthy',
        p_metadata: {
          last_execution: new Date().toISOString(),
          total_failures: result.failures,
          error_summary: 'All rotation attempts failed',
          job_run_id: jobRunId
        }
      });
      console.log('[HEARTBEAT] Recorded unhealthy heartbeat for fudo_rotate_token');
    }

    return new Response(JSON.stringify({
      success: result.failures === 0,
      message: `Processed ${result.processed} locations, ${result.successes} successful rotations, ${result.idempotent_hits} idempotent hits`,
      result,
      duration_ms: duration,
      job_run_id: jobRunId
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[FATAL] Fudo rotation job failed:", errorMsg);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMsg,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

serve(withCORS(handler));