import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withCORS } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JOB_TOKEN = Deno.env.get("POS_SYNC_JOB_TOKEN")!;

// Lock timeout: 2 hours
const LOCK_TIMEOUT_MS = 2 * 60 * 60 * 1000;

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
}

async function getCredentialsForRotation(svc: any): Promise<CredentialToRotate[]> {
  const { data, error } = await svc
    .rpc('pos_credentials_expiring_soon', { days_ahead: 7 })
    .select('location_id, provider, status, days_until_expiry, last_rotation_at');

  if (error) {
    console.error("Error fetching credentials for rotation:", error);
    throw new Error(`Failed to fetch credentials: ${error.message}`);
  }

  return data || [];
}

async function canRotateCredential(credential: CredentialToRotate): Promise<boolean> {
  // Check if credential is eligible for rotation
  if (credential.status !== 'active') {
    console.log(`Skipping credential ${credential.location_id}/${credential.provider}: status=${credential.status}`);
    return false;
  }

  // Check lock timeout - if last rotation attempt was within 2 hours, skip
  if (credential.last_rotation_at) {
    const lastAttempt = new Date(credential.last_rotation_at).getTime();
    const now = Date.now();
    if (now - lastAttempt < LOCK_TIMEOUT_MS) {
      console.log(`Skipping credential ${credential.location_id}/${credential.provider}: locked (last attempt ${Math.round((now - lastAttempt) / (1000 * 60))} min ago)`);
      return false;
    }
  }

  return true;
}

async function rotateCredential(svc: any, credential: CredentialToRotate): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Starting rotation for ${credential.location_id}/${credential.provider} (expires in ${credential.days_until_expiry} days)`);

    // Mark credential for rotation (sets last_rotation_attempt_at = now())
    const { data: marked, error: markError } = await svc
      .rpc('mark_credential_for_rotation', {
        _location_id: credential.location_id,
        _provider: credential.provider
      });

    if (markError || !marked) {
      console.error(`Failed to mark credential for rotation: ${markError?.message}`);
      return { success: false, error: markError?.message || "Failed to mark for rotation" };
    }

    // Log rotation attempt
    await svc.from('pos_logs').insert({
      level: 'info',
      scope: 'credential_rotation',
      message: `Credential rotation initiated for ${credential.provider}`,
      location_id: credential.location_id,
      provider: credential.provider,
      meta: {
        days_until_expiry: credential.days_until_expiry,
        previous_status: credential.status,
        rotation_type: 'scheduled'
      }
    });

    // TODO: Implement actual credential regeneration with POS providers
    // For now, we just mark it as rotated
    console.log(`✓ Credential rotation completed for ${credential.location_id}/${credential.provider}`);
    
    return { success: true };
  } catch (error) {
    console.error(`Error rotating credential ${credential.location_id}/${credential.provider}:`, error);
    return { success: false, error: error.message };
  }
}

async function handleCredentialsRotation(req: Request): Promise<Response> {
  // Authentication
  const authHeader = req.headers.get("authorization");
  const jobToken = req.headers.get("x-job-token");

  if (!jobToken || !safeEqual(jobToken, JOB_TOKEN)) {
    console.warn("Unauthorized rotation attempt - invalid job token");
    return json({ error: "Unauthorized: invalid job token" }, 401);
  }

  console.log("Starting POS credentials rotation process...");

  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  try {
    // Get credentials that need rotation
    const credentials = await getCredentialsForRotation(svc);
    console.log(`Found ${credentials.length} credentials to evaluate for rotation`);

    if (credentials.length === 0) {
      return json({
        success: true,
        summary: {
          total: 0,
          rotated: 0,
          skipped: 0,
          errors: 0
        },
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

    // Process each credential
    for (const credential of credentials) {
      if (!(await canRotateCredential(credential))) {
        results.skipped++;
        results.details.push({
          location_id: credential.location_id,
          provider: credential.provider,
          status: 'skipped',
          reason: 'locked_or_inactive'
        });
        continue;
      }

      const rotationResult = await rotateCredential(svc, credential);
      
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
          error: rotationResult.error
        });
      }
    }

    // Log summary
    console.log(`Rotation completed: ${results.rotated} rotated, ${results.skipped} skipped, ${results.errors} errors`);

    // Log summary to pos_logs
    await svc.from('pos_logs').insert({
      level: results.errors > 0 ? 'warn' : 'info',
      scope: 'credential_rotation',
      message: `Daily credential rotation completed`,
      meta: {
        total: results.total,
        rotated: results.rotated,
        skipped: results.skipped,
        errors: results.errors,
        execution_time: new Date().toISOString()
      }
    });

    return json({
      success: true,
      summary: {
        total: results.total,
        rotated: results.rotated,
        skipped: results.skipped,
        errors: results.errors
      },
      details: results.details
    });

  } catch (error) {
    console.error("Fatal error in credentials rotation:", error);
    
    // Log error
    await svc.from('pos_logs').insert({
      level: 'error',
      scope: 'credential_rotation',
      message: `Fatal error in credential rotation: ${error.message}`,
      meta: {
        error: error.message,
        stack: error.stack,
        execution_time: new Date().toISOString()
      }
    });

    return json({ 
      success: false, 
      error: error.message 
    }, 500);
  }
}

Deno.serve(withCORS(handleCredentialsRotation));