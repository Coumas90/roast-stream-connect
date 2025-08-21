import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";
import { withCORS } from "../_shared/cors.ts";
import { fudoLogger } from "../_shared/secure-logger.ts";
import { alertRotationFailures } from "../_shared/alerts.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface FailureAlert {
  location_id: string;
  provider: string;
  consecutive_failures: number;
  last_rotation_id: string;
  last_error: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const startTime = Date.now();
    fudoLogger.info('failure_monitor_start', {
      trigger: 'cron'
    });

    // Check for locations with consecutive rotation failures
    const { data: failures, error: failuresError } = await supabase.rpc(
      'check_consecutive_rotation_failures'
    );

    if (failuresError) {
      fudoLogger.error('failure_check_failed', failuresError);
      throw new Error(`Failed to check rotation failures: ${failuresError.message}`);
    }

    const failureAlerts: FailureAlert[] = failures || [];
    let alertsSent = 0;

    fudoLogger.info('failure_check_complete', {
      locations_with_failures: failureAlerts.length
    });

    // Send alerts for locations with 3+ consecutive failures
    for (const failure of failureAlerts) {
      try {
        await alertRotationFailures(
          failure.provider,
          failure.location_id,
          failure.consecutive_failures,
          failure.last_rotation_id,
          failure.last_error
        );

        alertsSent++;
        
        fudoLogger.info('failure_alert_sent', {
          provider: failure.provider,
          location_id: failure.location_id,
          consecutive_failures: failure.consecutive_failures,
          last_rotation_id: failure.last_rotation_id
        });

      } catch (alertError) {
        fudoLogger.error('failure_alert_failed', alertError instanceof Error ? alertError : new Error(String(alertError)), {
          provider: failure.provider,
          location_id: failure.location_id
        });
      }
    }

    const duration = Date.now() - startTime;

    fudoLogger.info('failure_monitor_complete', {
      locations_checked: failureAlerts.length,
      alerts_sent: alertsSent,
      elapsed_ms: duration
    });

    // Record our own heartbeat
    await supabase.rpc('update_job_heartbeat', {
      p_job_name: 'rotation_failure_monitor',
      p_status: 'healthy',
      p_metadata: {
        execution_time: new Date().toISOString(),
        locations_with_failures: failureAlerts.length,
        alerts_sent: alertsSent,
        duration_ms: duration
      }
    });

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      summary: {
        locations_with_failures: failureAlerts.length,
        alerts_sent: alertsSent,
        failures: failureAlerts.map(f => ({
          location_id: f.location_id,
          provider: f.provider,
          consecutive_failures: f.consecutive_failures
        }))
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    fudoLogger.error('failure_monitor_error', error instanceof Error ? error : new Error(String(error)));
    
    // Record failed heartbeat
    await supabase.rpc('update_job_heartbeat', {
      p_job_name: 'rotation_failure_monitor',
      p_status: 'failed',
      p_metadata: {
        execution_time: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      }
    });

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

serve(withCORS(handler));