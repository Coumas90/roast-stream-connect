import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'
import { alertCircuitBreakerOpen, alertRotationFailures, alertHealthcheckFailed } from '../_shared/alerts.ts'

interface AlertRule {
  id: string;
  name: string;
  alert_type: string;
  threshold_value: number;
  threshold_operator: string;
  cooldown_minutes: number;
  severity: string;
  channels: string[];
  metadata: Record<string, any>;
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

    // Get active alert rules from database
    const { data: alertRules, error: rulesError } = await supabaseClient
      .rpc('get_active_alert_rules');

    if (rulesError) {
      console.error('Error fetching alert rules:', rulesError);
      throw rulesError;
    }

    console.log(`📋 Found ${alertRules?.length || 0} active alert rules`);

    const alertsTriggered = [];

    // Check each alert rule
    for (const rule of alertRules || []) {
      // Check if alert is in cooldown using database function
      const { data: inCooldown, error: cooldownError } = await supabaseClient
        .rpc('is_alert_in_cooldown', {
          _alert_id: rule.id,
          _cooldown_minutes: rule.cooldown_minutes
        });

      if (cooldownError) {
        console.error(`Error checking cooldown for ${rule.id}:`, cooldownError);
        continue;
      }

      if (inCooldown) {
        console.log(`⏳ Alert ${rule.id} is in cooldown`);
        continue;
      }

      let shouldTrigger = false;
      let alertMessage = '';
      let currentValue = 0;

      // Evaluate alert conditions based on alert type and operator
      switch (rule.alert_type) {
        case 'health_score':
          currentValue = metrics.health_score;
          shouldTrigger = evaluateThreshold(currentValue, rule.threshold_value, rule.threshold_operator);
          if (shouldTrigger) {
            alertMessage = `System health score is ${currentValue} (${rule.threshold_operator} ${rule.threshold_value} threshold)`;
          }
          break;

        case 'expiration':
          currentValue = metrics.expirations_critical;
          shouldTrigger = evaluateThreshold(currentValue, rule.threshold_value, rule.threshold_operator);
          if (shouldTrigger) {
            alertMessage = `${currentValue} credentials are expiring soon (${rule.threshold_operator} ${rule.threshold_value} threshold)`;
          }
          break;

        case 'mttr':
          currentValue = metrics.avg_mttr_minutes;
          shouldTrigger = evaluateThreshold(currentValue, rule.threshold_value, rule.threshold_operator);
          if (shouldTrigger) {
            alertMessage = `Mean Time To Recovery is ${currentValue} minutes (${rule.threshold_operator} ${rule.threshold_value} threshold)`;
          }
          break;

        case 'circuit_breaker':
          currentValue = metrics.breakers_open;
          shouldTrigger = evaluateThreshold(currentValue, rule.threshold_value, rule.threshold_operator);
          if (shouldTrigger) {
            alertMessage = `${currentValue} circuit breakers are open (${rule.threshold_operator} ${rule.threshold_value} threshold)`;
          }
          break;
      }

      if (shouldTrigger) {
        console.log(`🚨 Triggering alert: ${rule.name}`);
        
        // Log the alert with proper metadata structure
        await supabaseClient
          .from('pos_logs')
          .insert({
            level: rule.severity === 'critical' ? 'error' : (rule.severity === 'error' ? 'error' : 'warn'),
            scope: 'proactive_alert',
            message: alertMessage,
            meta: {
              alert_id: rule.id,
              rule_name: rule.name,
              alert_type: rule.alert_type,
              threshold_value: rule.threshold_value,
              threshold_operator: rule.threshold_operator,
              current_value: currentValue,
              severity: rule.severity,
              health_metrics: metrics,
              timestamp: new Date().toISOString(),
            }
          });

        // Send external alert based on channels configured
        try {
          const channels = Array.isArray(rule.channels) ? rule.channels : JSON.parse(rule.channels || '["slack"]');
          
          if (channels.includes('slack') || channels.includes('email')) {
            await sendAlert(rule, alertMessage, currentValue, metrics);
          }
        } catch (alertError) {
          console.error(`Error sending ${rule.id} alert:`, alertError);
        }

        alertsTriggered.push({
          rule_id: rule.id,
          rule_name: rule.name,
          alert_type: rule.alert_type,
          message: alertMessage,
          severity: rule.severity,
          current_value: currentValue,
          threshold_value: rule.threshold_value,
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

// Helper function to evaluate threshold conditions
function evaluateThreshold(currentValue: number, thresholdValue: number, operator: string): boolean {
  switch (operator) {
    case '>':
      return currentValue > thresholdValue;
    case '>=':
      return currentValue >= thresholdValue;
    case '<':
      return currentValue < thresholdValue;
    case '<=':
      return currentValue <= thresholdValue;
    case '=':
      return currentValue === thresholdValue;
    default:
      console.warn(`Unknown operator: ${operator}, defaulting to >= behavior`);
      return currentValue >= thresholdValue;
  }
}

// Unified alert function that uses appropriate channels
async function sendAlert(rule: AlertRule, message: string, currentValue: number, metrics: HealthMetrics) {
  console.log(`Sending ${rule.alert_type} alert: ${message}`);
  
  const alertMetadata = {
    alert_type: rule.alert_type,
    rule_name: rule.name,
    current_value: currentValue,
    threshold_value: rule.threshold_value,
    threshold_operator: rule.threshold_operator,
    severity: rule.severity,
    health_metrics: metrics,
  };

  // Use the existing alert infrastructure
  await alertHealthcheckFailed(
    `proactive-${rule.alert_type}`,
    0, // hoursOverdue not applicable for proactive alerts
    rule.severity,
    alertMetadata
  );
}