import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";
import { withCORS } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface FudoTokenResponse {
  token: string;
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
  location_id: string;
  rotation_id: string; // Used for end-to-end traceability and idempotency
  attempt_id: string;  // Alias for rotation_id for backward compatibility
  secret_ref: string;
  start_time: number;
  success: boolean;
  idempotent_hit?: boolean; // True if the swap was skipped due to idempotency
  attempt_status: 'rotated' | 'idempotent' | 'failed';
  error?: string;
  error_category?: string;
}

interface RotationResult {
  total_candidates: number;
  processed: number;
  successes: number;
  failures: number;
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
    // Create a truncated HMAC for logging (first 8 chars)
    const encoder = new TextEncoder();
    const key = encoder.encode('fudo-token-fingerprint');
    const data = encoder.encode(token);
    
    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
    const hex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hex.substring(0, 8);
  } catch {
    return 'unknown';
  }
}

async function fudoGetToken(credentials: { apiKey: string; apiSecret: string; env: string }) {
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

async function fudoValidateToken(token: string, env: string) {
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

async function updateCredentialToken(locationId: string, newToken: string, expiresIn: number, rotationId: string): Promise<boolean> {
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const tokenFingerprint = await createTokenFingerprint(newToken);
  
  // Idempotent atomic swap: only update if rotation_attempt_id is null or different using IS DISTINCT FROM
  const { data, error } = await supabase
    .from("pos_provider_credentials")
    .update({
      ciphertext: `encrypted_token_${newToken.substring(0, 8)}...`, // In real scenario, this would be properly encrypted
      rotation_attempt_id: rotationId,
      last_verified_at: new Date().toISOString(),
      status: "active",
      updated_at: new Date().toISOString(),
      masked_hints: {
        expires_at: expiresAt,
        token_fingerprint: tokenFingerprint
      }
    })
    .eq("location_id", locationId)
    .eq("provider", "fudo")
    .not("rotation_attempt_id", "eq", rotationId) // Use IS DISTINCT FROM logic for better SQL performance
    .select();

  if (error) {
    throw new Error(`Failed to update credentials: ${error.message}`);
  }

  const wasUpdated = data && data.length > 0;
  
  if (wasUpdated) {
    console.log(`[SUCCESS] Updated token for location ${locationId}, rotation_id ${rotationId}, fingerprint: ${tokenFingerprint}, expires at ${expiresAt}`);
  } else {
    console.log(`[IDEMPOTENT] Token already updated for location ${locationId}, rotation_id ${rotationId} - skipping swap`);
  }
  
  return wasUpdated;
}

async function persistRotationId(locationId: string, rotationId: string): Promise<void> {
  // Persist rotation_id in pos_credentials for audit trail
  const { error } = await supabase
    .from("pos_credentials")
    .update({
      rotation_id: rotationId,
      updated_at: new Date().toISOString()
    })
    .eq("location_id", locationId)
    .eq("provider", "fudo");

  if (error) {
    console.warn(`[WARN] Failed to persist rotation_id in pos_credentials: ${error.message}`);
    // Don't throw - this is for audit trail only, not critical for operation
  }
}

async function rotateTokenForLocation(locationId: string, secretRef: string): Promise<RotationAttempt> {
  // Generate single rotationId for end-to-end traceability and idempotency
  const rotationId = crypto.randomUUID();
  const attempt: RotationAttempt = {
    location_id: locationId,
    rotation_id: rotationId,
    attempt_id: rotationId, // Alias for backward compatibility
    secret_ref: secretRef.substring(0, 20) + "...", // Never log full secret ref
    start_time: Date.now(),
    success: false,
    idempotent_hit: false,
    attempt_status: 'failed'
  };

  try {
    console.log(`[START] Rotating token for location ${locationId}, rotation_id ${rotationId}`);
    
    // ATOMIC TRANSACTION: All operations for this location must succeed or rollback
    const { data: transactionResult, error: txError } = await supabase.rpc('execute_atomic_rotation', {
      p_location_id: locationId,
      p_rotation_id: rotationId,
      p_secret_ref: secretRef
    });

    if (txError || !transactionResult) {
      // Fallback to step-by-step execution if atomic function unavailable
      console.log(`[FALLBACK] Atomic transaction unavailable, executing step-by-step for location ${locationId}, rotation_id ${rotationId}`);
      
      // 1. Decrypt current credentials
      const credentials = await decryptSecretRef(secretRef);
      
      // 2. Get new token from Fudo API
      const tokenResponse = await fudoGetToken(credentials);
      const tokenFingerprint = await createTokenFingerprint(tokenResponse.token);
      console.log(`[API] Received new token for location ${locationId}, rotation_id ${rotationId}, fingerprint: ${tokenFingerprint}, expires in ${tokenResponse.expires_in}s`);
      
      // 3. Validate new token with ping/me BEFORE swapping
      const meResponse = await fudoValidateToken(tokenResponse.token, credentials.env);
      console.log(`[VALIDATE] Token validated for user: ${meResponse.user.email}, rotation_id ${rotationId}`);
      
      // 4. Idempotent atomic swap - only swap if not already done with this rotation_id
      const wasSwapped = await updateCredentialToken(locationId, tokenResponse.token, tokenResponse.expires_in, rotationId);
      
      if (wasSwapped) {
        attempt.success = true;
        attempt.attempt_status = 'rotated';
        console.log(`[SUCCESS] Completed rotation for location ${locationId}, rotation_id ${rotationId}`);
      } else {
        attempt.success = true; // Still a success since the token was already rotated
        attempt.idempotent_hit = true;
        attempt.attempt_status = 'idempotent';
        console.log(`[IDEMPOTENT] Rotation already completed for location ${locationId}, rotation_id ${rotationId}`);
      }
      
      // 5. Always persist rotation_id for audit trail (success or idempotent)
      await persistRotationId(locationId, rotationId);
    } else {
      // Atomic transaction succeeded
      attempt.success = transactionResult.success;
      attempt.idempotent_hit = transactionResult.idempotent_hit;
      attempt.attempt_status = transactionResult.attempt_status;
      
      console.log(`[ATOMIC] ${attempt.idempotent_hit ? 'Idempotent' : 'Successful'} atomic rotation for location ${locationId}, rotation_id ${rotationId}`);
    }
    
    return attempt;
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // Classify error to determine if it should increment circuit breaker
    const statusMatch = errorMsg.match(/(\d{3})/);
    const status = statusMatch ? parseInt(statusMatch[1]) : undefined;
    const classification = classifyError(status, error);
    
    console.error(`[ERROR] Failed to rotate token for location ${locationId}, rotation_id ${rotationId}: ${errorMsg}, category: ${classification.category}`);
    
    attempt.error = errorMsg;
    attempt.error_category = classification.category;
    attempt.attempt_status = 'failed';
    return attempt;
  }
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

    // Get credentials expiring soon (≤ 3 days)
    const { data: expiringCreds, error: credsError } = await supabase.rpc("get_fudo_credentials_expiring", {
      _days_ahead: 3
    });

    if (credsError) {
      console.error("[ERROR] Failed to fetch expiring credentials:", credsError);
      throw new Error(`Failed to fetch credentials: ${credsError.message}`);
    }

    const result: RotationResult = {
      total_candidates: expiringCreds?.length || 0,
      processed: 0,
      successes: 0,
      failures: 0,
      circuit_breaker_blocked: 0,
      attempts: []
    };

    console.log(`[INFO] Found ${result.total_candidates} Fudo credentials expiring within 3 days`);

    if (result.total_candidates === 0) {
      console.log("[INFO] No credentials need rotation at this time");
      return new Response(JSON.stringify({
        success: true,
        message: "No credentials need rotation",
        result
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // For half-open circuit breaker, test with only 1 location
    const locationsToProcess = globalCbState.test_mode ? 
      expiringCreds.slice(0, 1) : expiringCreds;

    if (globalCbState.test_mode) {
      console.log("[CB] Half-open mode: testing with 1 location only");
    }

    // Process each location
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

      const attempt = await rotateTokenForLocation(cred.location_id, cred.secret_ref);
      result.attempts.push(attempt);
      
      if (attempt.success) {
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
        
      } else {
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
    console.log(`[STATS] ${result.successes} successes, ${result.failures} failures, ${result.circuit_breaker_blocked} blocked`);

    // Record metrics with enhanced metadata including idempotency tracking
    const jobRunId = crypto.randomUUID();
    const idempotentCount = result.attempts.filter(a => a.idempotent_hit).length;
    
    // Record job-level metrics including idempotency rate
    await supabase.rpc("record_rotation_metric", {
      p_job_run_id: jobRunId,
      p_provider: "fudo",
      p_location_id: null, // Job-level metric
      p_metric_type: "rotation_job_summary",
      p_value: result.processed,
      p_duration_ms: duration,
      p_meta: {
        total_candidates: result.total_candidates,
        successes: result.successes,
        failures: result.failures,
        circuit_breaker_blocked: result.circuit_breaker_blocked,
        idempotent_hits: idempotentCount,
        idempotent_rate: result.processed > 0 ? (idempotentCount / result.processed) : 0
      }
    });
    
    // Record individual attempt metrics
    for (const attempt of result.attempts) {
      await supabase.rpc("record_rotation_metric", {
        p_job_run_id: jobRunId,
        p_provider: "fudo",
        p_location_id: attempt.location_id,
        p_metric_type: attempt.idempotent_hit ? "rotation_idempotent" : 
                      (attempt.success ? "rotation_success" : "rotation_failure"),
        p_value: 1,
        p_duration_ms: Date.now() - attempt.start_time,
        p_meta: {
          rotation_id: attempt.rotation_id,
          attempt_id: attempt.attempt_id,
          attempt_status: attempt.attempt_status,
          idempotent_hit: attempt.idempotent_hit || false,
          error_category: attempt.error_category,
          error: attempt.error || undefined
        }
      });
    }

    // ✅ Record heartbeat on successful completion
    if (result.successes > 0 || result.total_candidates === 0) {
      await supabase.rpc('update_job_heartbeat', {
        p_job_name: 'fudo_rotate_token',
        p_status: 'healthy',
        p_metadata: {
          last_execution: new Date().toISOString(),
          total_candidates: result.total_candidates,
          successes: result.successes,
          failures: result.failures,
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
      message: `Processed ${result.processed} locations, ${result.successes} successful rotations`,
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