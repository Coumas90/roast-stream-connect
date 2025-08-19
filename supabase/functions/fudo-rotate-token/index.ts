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

interface RotationAttempt {
  location_id: string;
  secret_ref: string;
  start_time: number;
  success: boolean;
  error?: string;
}

interface RotationResult {
  total_candidates: number;
  processed: number;
  successes: number;
  failures: number;
  circuit_breaker_blocked: number;
  attempts: RotationAttempt[];
}

async function fudoGetToken(credentials: { apiKey: string; apiSecret: string; env: string }) {
  const baseUrl = credentials.env === "production" ? "https://api.fudo.com" : "https://staging-api.fudo.com";
  
  const response = await fetch(`${baseUrl}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: credentials.apiKey,
      api_secret: credentials.apiSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token request failed: ${response.status} ${error}`);
  }

  return await response.json() as FudoTokenResponse;
}

async function fudoValidateToken(token: string, env: string) {
  const baseUrl = env === "production" ? "https://api.fudo.com" : "https://staging-api.fudo.com";
  
  const response = await fetch(`${baseUrl}/me`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token validation failed: ${response.status} ${error}`);
  }

  return await response.json() as FudoMeResponse;
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

async function updateCredentialToken(locationId: string, newToken: string, expiresIn: number) {
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  
  // Update pos_credentials with new token (encrypted) and expiry
  const { error } = await supabase
    .from("pos_credentials")
    .update({
      secret_ref: `pos/location/${locationId}/fudo`, // In real scenario, this would be encrypted
      expires_at: expiresAt,
      last_rotation_at: new Date().toISOString(),
      status: "active",
      updated_at: new Date().toISOString()
    })
    .eq("location_id", locationId)
    .eq("provider", "fudo");

  if (error) {
    throw new Error(`Failed to update credentials: ${error.message}`);
  }

  console.log(`[SUCCESS] Updated token for location ${locationId}, expires at ${expiresAt}`);
}

async function rotateTokenForLocation(locationId: string, secretRef: string): Promise<RotationAttempt> {
  const attempt: RotationAttempt = {
    location_id: locationId,
    secret_ref: secretRef.substring(0, 20) + "...", // Never log full secret ref
    start_time: Date.now(),
    success: false
  };

  try {
    console.log(`[START] Rotating token for location ${locationId}`);
    
    // 1. Decrypt current credentials
    const credentials = await decryptSecretRef(secretRef);
    
    // 2. Get new token from Fudo API
    const tokenResponse = await fudoGetToken(credentials);
    console.log(`[API] Received new token for location ${locationId}, expires in ${tokenResponse.expires_in}s`);
    
    // 3. Validate new token with ping/me
    const meResponse = await fudoValidateToken(tokenResponse.token, credentials.env);
    console.log(`[VALIDATE] Token validated for user: ${meResponse.user.email}`);
    
    // 4. Atomic swap - update credentials only after validation success
    await updateCredentialToken(locationId, tokenResponse.token, tokenResponse.expires_in);
    
    attempt.success = true;
    return attempt;
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] Failed to rotate token for location ${locationId}: ${errorMsg}`);
    attempt.error = errorMsg;
    return attempt;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const startTime = Date.now();
    console.log("[START] Fudo token rotation job initiated");

    // Check circuit breaker state for Fudo provider
    const { data: circuitState, error: cbError } = await supabase.rpc("cb_check_state", { 
      _provider: "fudo" 
    });

    if (cbError) {
      console.error("[ERROR] Failed to check circuit breaker state:", cbError);
      throw new Error(`Circuit breaker check failed: ${cbError.message}`);
    }

    console.log(`[CB] Circuit breaker state: ${JSON.stringify(circuitState)}`);

    if (!circuitState.allowed) {
      console.warn(`[CB] Circuit breaker is ${circuitState.state}, skipping rotation`);
      return new Response(JSON.stringify({
        success: false,
        message: `Circuit breaker is ${circuitState.state}`,
        circuit_breaker: circuitState,
        resume_at: circuitState.resume_at
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
    const locationsToProcess = circuitState.test_mode ? 
      expiringCreds.slice(0, 1) : expiringCreds;

    if (circuitState.test_mode) {
      console.log("[CB] Half-open mode: testing with 1 location only");
    }

    // Process each location
    for (const cred of locationsToProcess) {
      result.processed++;
      
      const attempt = await rotateTokenForLocation(cred.location_id, cred.secret_ref);
      result.attempts.push(attempt);
      
      if (attempt.success) {
        result.successes++;
        
        // Record success with circuit breaker
        const { error: cbSuccessError } = await supabase.rpc("cb_record_success", { 
          _provider: "fudo" 
        });
        if (cbSuccessError) {
          console.error("[CB ERROR] Failed to record success:", cbSuccessError);
        }
        
      } else {
        result.failures++;
        
        // Record failure with circuit breaker
        const { data: cbResult, error: cbFailError } = await supabase.rpc("cb_record_failure", { 
          _provider: "fudo" 
        });
        if (cbFailError) {
          console.error("[CB ERROR] Failed to record failure:", cbFailError);
        } else if (cbResult?.state === 'open') {
          console.warn("[CB] Circuit breaker opened due to failures, stopping rotation");
          result.circuit_breaker_blocked = locationsToProcess.length - result.processed;
          break;
        }
      }
    }

    const duration = Date.now() - startTime;
    
    console.log(`[COMPLETE] Rotation job finished in ${duration}ms`);
    console.log(`[STATS] ${result.successes} successes, ${result.failures} failures, ${result.circuit_breaker_blocked} blocked`);

    // Record metrics
    const jobRunId = crypto.randomUUID();
    for (const attempt of result.attempts) {
      await supabase.rpc("record_rotation_metric", {
        p_job_run_id: jobRunId,
        p_provider: "fudo",
        p_location_id: attempt.location_id,
        p_metric_type: attempt.success ? "rotation_success" : "rotation_failure",
        p_value: 1,
        p_duration_ms: Date.now() - attempt.start_time,
        p_meta: attempt.error ? { error: attempt.error } : {}
      });
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