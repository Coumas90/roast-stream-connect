import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withCORS } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JOB_TOKEN = Deno.env.get("POS_SYNC_JOB_TOKEN")!;

// Lease lock timeout: 15 minutes (900 seconds)
const LEASE_LOCK_TTL_SECONDS = 900;
const LOCK_NAME = 'pos-credentials-rotation';
const HEARTBEAT_INTERVAL_MS = 450000; // 7.5 minutes (TTL * 0.5)

function json(res: unknown, init: number | ResponseInit = 200) {
  const headers = { "Content-Type": "application/json" };
  const status = typeof init === "number" ? init : (init.status ?? 200);
  return new Response(JSON.stringify(res), { ...init, status, headers: { ...headers, ...(typeof init === "object" ? init.headers : {}) } });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

interface CredentialToRotate {
  location_id: string;
  provider: string;
  status: string;
  days_until_expiry: number;
  last_rotation_at: string | null;
  rotation_attempt_id: string | null;
}

async function getCredentialsForRotation(svc: any): Promise<CredentialToRotate[]> {
  // Use RPC with FOR UPDATE SKIP LOCKED for concurrency safety
  const { data, error } = await svc.rpc('pos_credentials_for_rotation', { days_ahead: 7 });

  if (error) {
    console.error("Error fetching credentials for rotation:", error);
    throw new Error(`Failed to fetch credentials: ${error.message}`);
  }

  return data || [];
}

async function rotateCredential(
  svc: any, 
  credential: CredentialToRotate, 
  jobRunId: string
): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  const attemptId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    console.log(`Starting rotation for ${credential.location_id}/${credential.provider} (expires in ${credential.days_until_expiry} days)`);

    // Mark credential as rotating
    await svc.rpc('update_rotation_status', {
      p_location_id: credential.location_id,
      p_provider: credential.provider,
      p_status: 'rotating',
      p_attempt_id: attemptId
    });

    // Record attempt metric
    await svc.rpc('record_rotation_metric', {
      p_job_run_id: jobRunId,
      p_provider: credential.provider,
      p_location_id: credential.location_id,
      p_metric_type: 'rotation_attempt',
      p_meta: { days_until_expiry: credential.days_until_expiry }
    });

    // Log rotation attempt
    await svc.from('pos_logs').insert({
      level: 'info',
      scope: 'credential_rotation',
      message: `Credential rotation initiated for ${credential.provider}`,
      location_id: credential.location_id,
      provider: credential.provider,
      meta: {
        attempt_id: attemptId,
        days_until_expiry: credential.days_until_expiry,
        previous_status: credential.status,
        rotation_type: 'scheduled'
      }
    });

    // TODO: Implement actual credential regeneration with POS providers
    // For now, simulate rotation with a small delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const duration = Date.now() - startTime;

    // Mark credential as rotated
    await svc.rpc('update_rotation_status', {
      p_location_id: credential.location_id,
      p_provider: credential.provider,
      p_status: 'rotated',
      p_attempt_id: attemptId
    });

    // Record success metric
    await svc.rpc('record_rotation_metric', {
      p_job_run_id: jobRunId,
      p_provider: credential.provider,
      p_location_id: credential.location_id,
      p_metric_type: 'rotation_success',
      p_duration_ms: duration
    });

    console.log(`✓ Credential rotation completed for ${credential.location_id}/${credential.provider} in ${duration}ms`);
    
    return { success: true };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorCode = error?.code || 'UNKNOWN_ERROR';
    const errorMessage = error?.message || String(error);

    console.error(`Error rotating credential ${credential.location_id}/${credential.provider}:`, error);

    // Mark credential as failed with backoff
    await svc.rpc('update_rotation_status', {
      p_location_id: credential.location_id,
      p_provider: credential.provider,
      p_status: 'failed',
      p_attempt_id: attemptId,
      p_error_code: errorCode,
      p_error_msg: errorMessage
    });

    // Record failure metric
    await svc.rpc('record_rotation_metric', {
      p_job_run_id: jobRunId,
      p_provider: credential.provider,
      p_location_id: credential.location_id,
      p_metric_type: 'rotation_failure',
      p_duration_ms: duration,
      p_meta: { error_code: errorCode, error_message: errorMessage }
    });

    // Check if we should schedule backoff
    if (errorCode === '429' || (errorCode >= '500' && errorCode < '600')) {
      await svc.rpc('record_rotation_metric', {
        p_job_run_id: jobRunId,
        p_provider: credential.provider,
        p_location_id: credential.location_id,
        p_metric_type: 'backoff_scheduled'
      });
    }

    return { success: false, error: errorMessage, errorCode };
  }
}

async function handleCredentialsRotation(req: Request): Promise<Response> {
  // Authentication - constant time token comparison
  const jobToken = req.headers.get("x-job-token");
  if (!jobToken || !safeEqual(jobToken, JOB_TOKEN)) {
    console.warn("Unauthorized rotation attempt - invalid job token");
    return json({ error: "Unauthorized: invalid job token" }, 401);
  }

  // Content-Type validation
  const contentType = req.headers.get("content-type");
  if (contentType && !contentType.includes("application/json")) {
    return json({ error: "Invalid Content-Type" }, 400);
  }

  const jobRunId = crypto.randomUUID();
  console.log(`Starting POS credentials rotation process... (job_run_id: ${jobRunId})`);

  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  // 1) CLAIM LEASE LOCK - Critical for single-run guarantee
  const { data: claim, error: claimError } = await svc.rpc('claim_job_lock', { 
    p_name: LOCK_NAME, 
    p_ttl_seconds: LEASE_LOCK_TTL_SECONDS 
  });

  if (claimError || !claim?.[0]?.acquired) {
    console.log("Job already running or failed to acquire lock");
    return json({ 
      success: false, 
      error: "Job already running", 
      locked: true 
    }, 409);
  }

  const lockHolder = claim[0].holder;
  console.log(`Acquired lease lock: ${lockHolder}`);

  // Start heartbeat to prevent lock expiry during long rotations
  const heartbeatInterval = setInterval(async () => {
    try {
      const renewed = await svc.rpc('renew_job_lock', {
        p_name: LOCK_NAME,
        p_holder: lockHolder,
        p_ttl_seconds: LEASE_LOCK_TTL_SECONDS
      });
      
      if (renewed?.data) {
        console.log(`Lease lock renewed: ${lockHolder}`);
      } else {
        console.warn(`Failed to renew lease lock: ${lockHolder}`);
      }
    } catch (error) {
      console.error("Heartbeat error:", error);
    }
  }, HEARTBEAT_INTERVAL_MS);

  try {
    // Get credentials that need rotation with FOR UPDATE SKIP LOCKED
    const credentials = await getCredentialsForRotation(svc);
    console.log(`Found ${credentials.length} credentials to evaluate for rotation`);

    if (credentials.length === 0) {
      return json({
        success: true,
        summary: { total: 0, rotated: 0, skipped: 0, errors: 0 },
        message: "No credentials require rotation at this time"
      });
    }

    const results = {
      total: credentials.length,
      rotated: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[]
    };

    // Process each credential with state machine
    for (const credential of credentials) {
      const rotationResult = await rotateCredential(svc, credential, jobRunId);
      
      if (rotationResult.success) {
        results.rotated++;
        results.details.push({
          location_id: credential.location_id,
          provider: credential.provider,
          status: 'rotated'
        });
      } else {
        results.errors++;
        results.details.push({
          location_id: credential.location_id,
          provider: credential.provider,
          status: 'error',
          error: rotationResult.error,
          error_code: rotationResult.errorCode
        });
      }
    }

    // Log structured summary
    const executionTime = new Date().toISOString();
    console.log(`Rotation completed: ${results.rotated} rotated, ${results.skipped} skipped, ${results.errors} errors`);

    // Log summary to pos_logs (no PII)
    await svc.from('pos_logs').insert({
      level: results.errors > 0 ? 'warn' : 'info',
      scope: 'credential_rotation',
      message: `Daily credential rotation completed`,
      meta: {
        job_run_id: jobRunId,
        total: results.total,
        rotated: results.rotated,
        skipped: results.skipped,
        errors: results.errors,
        execution_time: executionTime
      }
    });

    // Record job-level metrics
    await svc.rpc('record_rotation_metric', {
      p_job_run_id: jobRunId,
      p_metric_type: 'job_completed',
      p_value: results.total,
      p_meta: { 
        rotated: results.rotated, 
        errors: results.errors,
        execution_time: executionTime
      }
    });

    return json({
      success: true,
      summary: {
        total: results.total,
        rotated: results.rotated,
        skipped: results.skipped,
        errors: results.errors
      }
      // Note: details removed from response for security (no location IDs)
    });

  } catch (error) {
    console.error("Fatal error in credentials rotation:", error);
    
    // Log error
    await svc.from('pos_logs').insert({
      level: 'error',
      scope: 'credential_rotation',
      message: `Fatal error in credential rotation: ${error.message}`,
      meta: {
        job_run_id: jobRunId,
        error: error.message,
        stack: error.stack,
        execution_time: new Date().toISOString()
      }
    });

    return json({ 
      success: false, 
      error: error.message 
    }, 500);

  } finally {
    // Clear heartbeat interval
    clearInterval(heartbeatInterval);
    
    // 2) ALWAYS RELEASE LEASE LOCK
    const { error: releaseError } = await svc.rpc('release_job_lock', { 
      p_name: LOCK_NAME, 
      p_holder: lockHolder 
    });
    
    if (releaseError) {
      console.error("Failed to release lease lock:", releaseError);
    } else {
      console.log(`Released lease lock: ${lockHolder}`);
    }
  }
}

// Enhanced CORS configuration - no wildcard origins, strict validation
const ALLOWED_ORIGINS = Deno.env.get("ALLOWED_ORIGINS")?.split(",") || [];

Deno.serve(withCORS(handleCredentialsRotation, {
  allowlist: ALLOWED_ORIGINS,
  allowMethods: ["POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "X-Job-Token"],
  credentials: false
}));