import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'
import { alertCircuitBreakerOpen, alertRotationFailures, alertHealthcheckFailed } from '../_shared/alerts.ts'

interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  threshold: number;
  cooldown_minutes: number;
  last_triggered?: string;
}

interface HealthMetrics {
  health_score: number;
  expirations_critical: number;
  expirations_warning: number;
  breakers_open: number;
  avg_mttr_minutes: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for admin access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('🔍 Starting proactive alerts evaluation...');

    // Get current dashboard metrics
    const { data: dashboardData, error: dashboardError } = await supabaseClient
      .rpc('get_pos_dashboard_summary');

    if (dashboardError) {
      console.error('Error fetching dashboard summary:', dashboardError);
      throw dashboardError;
    }

    const metrics: HealthMetrics = dashboardData.summary;
    console.log('📊 Current metrics:', metrics);

    // Define alert rules (these could be moved to database configuration later)
    const alertRules: AlertRule[] = [
      {
        id: 'health_score_warning',
        name: 'Health Score Warning',
        enabled: true,
        threshold: 80, // Alert when health score drops below 80
        cooldown_minutes: 60,
      },
      {
        id: 'health_score_critical',
        name: 'Health Score Critical',
        enabled: true,
        threshold: 60, // Alert when health score drops below 60
        cooldown_minutes: 30,
      },
      {
        id: 'critical_expirations_threshold',
        name: 'Critical Expirations Alert',
        enabled: true,
        threshold: 5, // Alert when 5+ credentials expire soon
        cooldown_minutes: 120,
      },
      {
        id: 'mttr_degradation',
        name: 'MTTR Degradation Alert',
        enabled: true,
        threshold: 180, // Alert when MTTR exceeds 3 hours
        cooldown_minutes: 180,
      },
    ];

    const alertsTriggered = [];

    // Check each alert rule
    for (const rule of alertRules) {
      if (!rule.enabled) continue;

      // Check if cooldown period has passed
      const { data: lastAlert } = await supabaseClient
        .from('pos_logs')
        .select('ts')
        .eq('scope', 'proactive_alert')
        .eq('event_code', rule.id)
        .order('ts', { ascending: false })
        .limit(1);

      if (lastAlert && lastAlert.length > 0) {
        const lastTriggered = new Date(lastAlert[0].ts);
        const cooldownEnd = new Date(lastTriggered.getTime() + (rule.cooldown_minutes * 60 * 1000));
        if (new Date() < cooldownEnd) {
          console.log(`⏳ Alert ${rule.id} in cooldown until ${cooldownEnd.toISOString()}`);
          continue;
        }
      }

      let shouldTrigger = false;
      let alertMessage = '';
      let severity = 'warning';

      // Evaluate alert conditions
      switch (rule.id) {
        case 'health_score_warning':
          if (metrics.health_score < rule.threshold && metrics.health_score >= 60) {
            shouldTrigger = true;
            alertMessage = `System health score has dropped to ${metrics.health_score} (below ${rule.threshold} threshold)`;
            severity = 'warning';
          }
          break;

        case 'health_score_critical':
          if (metrics.health_score < rule.threshold) {
            shouldTrigger = true;
            alertMessage = `CRITICAL: System health score has dropped to ${metrics.health_score} (below ${rule.threshold} threshold)`;
            severity = 'critical';
          }
          break;

        case 'critical_expirations_threshold':
          if (metrics.expirations_critical >= rule.threshold) {
            shouldTrigger = true;
            alertMessage = `${metrics.expirations_critical} credentials are expiring soon (threshold: ${rule.threshold})`;
            severity = 'warning';
          }
          break;

        case 'mttr_degradation':
          if (metrics.avg_mttr_minutes > rule.threshold) {
            shouldTrigger = true;
            alertMessage = `Mean Time To Recovery has increased to ${metrics.avg_mttr_minutes} minutes (threshold: ${rule.threshold})`;
            severity = 'warning';
          }
          break;
      }

      if (shouldTrigger) {
        console.log(`🚨 Triggering alert: ${rule.name}`);
        
        // Log the alert
        await supabaseClient
          .from('pos_logs')
          .insert({
            level: severity === 'critical' ? 'error' : 'warn',
            scope: 'proactive_alert',
            event_code: rule.id,
            message: alertMessage,
            meta: {
              rule_name: rule.name,
              threshold: rule.threshold,
              current_value: getMetricValue(metrics, rule.id),
              health_metrics: metrics,
              timestamp: new Date().toISOString(),
            }
          });

        // Send external alert based on type
        try {
          if (rule.id.includes('health_score')) {
            await sendHealthScoreAlert(alertMessage, severity, metrics);
          } else if (rule.id.includes('expirations')) {
            await sendExpirationAlert(alertMessage, severity, metrics.expirations_critical);
          } else if (rule.id.includes('mttr')) {
            await sendMTTRAlert(alertMessage, severity, metrics.avg_mttr_minutes);
          }
        } catch (alertError) {
          console.error(`Error sending ${rule.id} alert:`, alertError);
        }

        alertsTriggered.push({
          rule_id: rule.id,
          rule_name: rule.name,
          message: alertMessage,
          severity,
        });
      }
    }

    // Update job heartbeat
    await supabaseClient.rpc('update_job_heartbeat', {
      p_job_name: 'proactive-alerts',
      p_status: 'healthy',
      p_metadata: {
        alerts_evaluated: alertRules.length,
        alerts_triggered: alertsTriggered.length,
        health_score: metrics.health_score,
        execution_time: Date.now(),
      }
    });

    console.log(`✅ Proactive alerts evaluation completed. Triggered ${alertsTriggered.length} alerts.`);

    return new Response(JSON.stringify({
      success: true,
      alerts_evaluated: alertRules.length,
      alerts_triggered: alertsTriggered.length,
      triggered_alerts: alertsTriggered,
      current_metrics: metrics,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in proactive-alerts function:', error);
    
    // Try to update heartbeat with error status
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      
      await supabaseClient.rpc('update_job_heartbeat', {
        p_job_name: 'proactive-alerts',
        p_status: 'error',
        p_metadata: {
          error: error.message,
          timestamp: new Date().toISOString(),
        }
      });
    } catch (heartbeatError) {
      console.error('Failed to update error heartbeat:', heartbeatError);
    }

    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Helper function to get metric value by rule ID
function getMetricValue(metrics: HealthMetrics, ruleId: string): number {
  switch (ruleId) {
    case 'health_score_warning':
    case 'health_score_critical':
      return metrics.health_score;
    case 'critical_expirations_threshold':
      return metrics.expirations_critical;
    case 'mttr_degradation':
      return metrics.avg_mttr_minutes;
    default:
      return 0;
  }
}

// Specialized alert functions
async function sendHealthScoreAlert(message: string, severity: string, metrics: HealthMetrics) {
  console.log(`Sending health score alert: ${message}`);
  // For now, use the existing alertHealthcheckFailed as a template
  // In the future, this could be a specialized health score alert
  await alertHealthcheckFailed(
    'pos-dashboard-health',
    0, // hoursOverdue not applicable here
    severity,
    {
      alert_type: 'health_score',
      current_score: metrics.health_score,
      critical_expirations: metrics.expirations_critical,
      warning_expirations: metrics.expirations_warning,
      open_breakers: metrics.breakers_open,
      avg_mttr: metrics.avg_mttr_minutes,
    }
  );
}

async function sendExpirationAlert(message: string, severity: string, count: number) {
  console.log(`Sending expiration alert: ${message}`);
  // This would ideally be a specialized expiration alert
  await alertHealthcheckFailed(
    'credential-expirations',
    0,
    severity,
    {
      alert_type: 'credential_expiration',
      expiring_count: count,
      message: message,
    }
  );
}

async function sendMTTRAlert(message: string, severity: string, mttr: number) {
  console.log(`Sending MTTR alert: ${message}`);
  await alertHealthcheckFailed(
    'mttr-degradation',
    0,
    severity,
    {
      alert_type: 'mttr_degradation',
      current_mttr: mttr,
      message: message,
    }
  );
}