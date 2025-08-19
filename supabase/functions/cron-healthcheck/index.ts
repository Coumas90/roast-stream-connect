import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthcheckResult {
  healthy_jobs: string[];
  unhealthy_jobs: Array<{
    job_name: string;
    last_run_at: string;
    hours_overdue: number;
    status: string;
    metadata?: any;
  }>;
  alerts_sent: number;
  suppressed_alerts: number;
}

async function sendSlackAlert(job: any): Promise<boolean> {
  const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
  if (!webhookUrl) {
    console.warn('[ALERT] SLACK_WEBHOOK_URL not configured, skipping Slack notification');
    return false;
  }

  const message = {
    text: `🚨 Job Health Alert`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🚨 *Job Health Alert*\n\n*Job:* \`${job.job_name}\`\n*Status:* ${job.status}\n*Last Run:* ${job.last_run_at}\n*Hours Overdue:* ${job.hours_overdue}h\n\n⚠️ This job hasn't run successfully in over 24 hours.`
        }
      }
    ]
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      console.error('[ALERT] Slack webhook failed:', response.status, await response.text());
      return false;
    }

    console.log(`[ALERT] Slack notification sent for job: ${job.job_name}`);
    return true;
  } catch (error) {
    console.error('[ALERT] Slack webhook error:', error);
    return false;
  }
}

async function sendEmailAlert(job: any): Promise<boolean> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.warn('[ALERT] RESEND_API_KEY not configured, skipping email notification');
    return false;
  }

  const emailBody = `
    <h2>🚨 Job Health Alert</h2>
    <p><strong>Job:</strong> ${job.job_name}</p>
    <p><strong>Status:</strong> ${job.status}</p>
    <p><strong>Last Run:</strong> ${job.last_run_at}</p>
    <p><strong>Hours Overdue:</strong> ${job.hours_overdue}h</p>
    
    <p>⚠️ This critical job hasn't run successfully in over 24 hours. Immediate attention required.</p>
    
    <p><strong>Recommended Actions:</strong></p>
    <ul>
      <li>Check job logs and error messages</li>
      <li>Verify system health and dependencies</li>
      <li>Manual job execution if needed</li>
    </ul>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'alerts@tupaplatform.com',
        to: ['ops@tupaplatform.com'],
        subject: `🚨 Job Alert: ${job.job_name} overdue`,
        html: emailBody
      })
    });

    if (!response.ok) {
      console.error('[ALERT] Email send failed:', response.status, await response.text());
      return false;
    }

    console.log(`[ALERT] Email notification sent for job: ${job.job_name}`);
    return true;
  } catch (error) {
    console.error('[ALERT] Email send error:', error);
    return false;
  }
}

async function checkJobHeartbeats(supabase: any): Promise<HealthcheckResult> {
  const result: HealthcheckResult = {
    healthy_jobs: [],
    unhealthy_jobs: [],
    alerts_sent: 0,
    suppressed_alerts: 0
  };

  // Query jobs that are overdue (last_run_at > 24h ago)
  const { data: overdueJobs, error } = await supabase
    .from('job_heartbeats')
    .select('*')
    .lt('last_run_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    console.error('[HEALTHCHECK] Database query failed:', error);
    throw new Error(`Database query failed: ${error.message}`);
  }

  // Query all jobs for healthy count
  const { data: allJobs } = await supabase
    .from('job_heartbeats')
    .select('job_name');

  const allJobNames = new Set(allJobs?.map((j: any) => j.job_name) || []);

  for (const job of overdueJobs || []) {
    const hoursOverdue = Math.floor(
      (Date.now() - new Date(job.last_run_at).getTime()) / (60 * 60 * 1000)
    );

    const unhealthyJob = {
      job_name: job.job_name,
      last_run_at: job.last_run_at,
      hours_overdue: hoursOverdue,
      status: job.status,
      metadata: job.metadata
    };

    result.unhealthy_jobs.push(unhealthyJob);

    // Check if we should suppress alerts (circuit breaker)
    // Only send alert if we haven't alerted for this job in the last 6 hours
    const lastAlertKey = `alert_${job.job_name}`;
    const { data: lastAlert } = await supabase
      .from('job_heartbeats')
      .select('metadata')
      .eq('job_name', lastAlertKey)
      .single();

    const lastAlertTime = lastAlert?.metadata?.last_alert_sent;
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;

    if (lastAlertTime && new Date(lastAlertTime).getTime() > sixHoursAgo) {
      result.suppressed_alerts++;
      console.log(`[ALERT] Suppressing alert for ${job.job_name} (already alerted within 6h)`);
      continue;
    }

    // Send alerts
    const slackSent = await sendSlackAlert(unhealthyJob);
    const emailSent = await sendEmailAlert(unhealthyJob);

    if (slackSent || emailSent) {
      result.alerts_sent++;
      
      // Record alert timestamp to prevent spam
      await supabase.rpc('update_job_heartbeat', {
        p_job_name: lastAlertKey,
        p_status: 'alert_sent',
        p_metadata: {
          last_alert_sent: new Date().toISOString(),
          alert_for_job: job.job_name,
          channels_sent: { slack: slackSent, email: emailSent }
        }
      });
    }
  }

  // Count healthy jobs
  for (const jobName of allJobNames) {
    if (!result.unhealthy_jobs.find(j => j.job_name === jobName)) {
      result.healthy_jobs.push(jobName);
    }
  }

  return result;
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const startTime = Date.now();
    console.log('[HEALTHCHECK] Starting job heartbeat healthcheck');

    const result = await checkJobHeartbeats(supabase);
    const duration = Date.now() - startTime;

    console.log('[HEALTHCHECK] Completed:', {
      healthy_jobs: result.healthy_jobs.length,
      unhealthy_jobs: result.unhealthy_jobs.length,
      alerts_sent: result.alerts_sent,
      suppressed_alerts: result.suppressed_alerts,
      duration_ms: duration
    });

    // Record our own healthcheck heartbeat
    await supabase.rpc('update_job_heartbeat', {
      p_job_name: 'cron_healthcheck',
      p_status: 'healthy',
      p_metadata: {
        execution_time: new Date().toISOString(),
        jobs_checked: result.healthy_jobs.length + result.unhealthy_jobs.length,
        alerts_sent: result.alerts_sent,
        duration_ms: duration
      }
    });

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      summary: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('[HEALTHCHECK] Fatal error:', error);
    
    // Record failed healthcheck
    await supabase.rpc('update_job_heartbeat', {
      p_job_name: 'cron_healthcheck',
      p_status: 'failed',
      p_metadata: {
        execution_time: new Date().toISOString(),
        error: error.message,
        stack: error.stack
      }
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

serve(handler);