// Standardized Alert System for Fudo Operations
// Handles Slack/Email notifications with rate limiting and structured payloads

import { SecureLogger, LogFields } from "./secure-logger.ts";

const alertLogger = new SecureLogger('alerts');

export interface AlertPayload {
  type: 'circuit_breaker_open' | 'rotation_failures' | 'healthcheck_failed' | 'custom';
  provider: string;
  location_id?: string;
  tenant?: string;
  severity: 'info' | 'warn' | 'error' | 'critical';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

// Rate limiting: prevent spam alerts (15min window per alert type+location)
const alertCache = new Map<string, number>();

function getAlertKey(payload: AlertPayload): string {
  return `${payload.type}:${payload.provider}:${payload.location_id || 'global'}`;
}

function shouldSuppressAlert(payload: AlertPayload): boolean {
  const key = getAlertKey(payload);
  const lastAlertTime = alertCache.get(key) || 0;
  const now = Date.now();
  const suppressionWindow = 15 * 60 * 1000; // 15 minutes
  
  if (now - lastAlertTime < suppressionWindow) {
    alertLogger.warn('alert_suppressed', {
      alert_type: payload.type,
      provider: payload.provider,
      location_id: payload.location_id,
      last_alert_ago_ms: now - lastAlertTime,
      suppression_window_ms: suppressionWindow
    });
    return true;
  }
  
  alertCache.set(key, now);
  return false;
}

export async function sendSlackAlert(payload: AlertPayload): Promise<boolean> {
  const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
  if (!webhookUrl) {
    alertLogger.warn('slack_webhook_not_configured');
    return false;
  }

  if (shouldSuppressAlert(payload)) {
    return false;
  }

  const severityEmoji = {
    info: '💡',
    warn: '⚠️', 
    error: '🚨',
    critical: '🔥'
  };

  const message = {
    text: `${severityEmoji[payload.severity]} ${payload.title}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${payload.title}*\n${payload.message}`
        }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Provider:* ${payload.provider}` },
          { type: "mrkdwn", text: `*Severity:* ${payload.severity}` },
          ...(payload.location_id ? [{ type: "mrkdwn", text: `*Location:* ${payload.location_id}` }] : []),
          ...(payload.tenant ? [{ type: "mrkdwn", text: `*Tenant:* ${payload.tenant}` }] : []),
          { type: "mrkdwn", text: `*Time:* ${payload.timestamp || new Date().toISOString()}` }
        ]
      }
    ]
  };

  if (payload.metadata) {
    message.blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Details:*\n\`\`\`${JSON.stringify(payload.metadata, null, 2)}\`\`\``
      }
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      const error = await response.text();
      alertLogger.error('slack_webhook_failed', {
        status: response.status,
        error,
        alert_type: payload.type
      });
      return false;
    }

    alertLogger.info('slack_alert_sent', {
      alert_type: payload.type,
      provider: payload.provider,
      location_id: payload.location_id,
      severity: payload.severity
    });
    return true;
  } catch (error) {
    alertLogger.error('slack_webhook_error', error instanceof Error ? error : new Error(String(error)), {
      alert_type: payload.type
    });
    return false;
  }
}

export async function sendEmailAlert(payload: AlertPayload): Promise<boolean> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    alertLogger.warn('resend_api_key_not_configured');
    return false;
  }

  if (shouldSuppressAlert(payload)) {
    return false;
  }

  const emailBody = `
    <h2>${payload.title}</h2>
    <p>${payload.message}</p>
    <hr>
    <p><strong>Provider:</strong> ${payload.provider}</p>
    <p><strong>Severity:</strong> ${payload.severity}</p>
    ${payload.location_id ? `<p><strong>Location ID:</strong> ${payload.location_id}</p>` : ''}
    ${payload.tenant ? `<p><strong>Tenant:</strong> ${payload.tenant}</p>` : ''}
    <p><strong>Timestamp:</strong> ${payload.timestamp || new Date().toISOString()}</p>
    ${payload.metadata ? `
      <h3>Details</h3>
      <pre><code>${JSON.stringify(payload.metadata, null, 2)}</code></pre>
    ` : ''}
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Tupá Alerts <alerts@tupa.com>',
        to: ['ops@tupa.com'], // Configure in env
        subject: `[${payload.severity.toUpperCase()}] ${payload.title}`,
        html: emailBody
      })
    });

    if (!response.ok) {
      const error = await response.text();
      alertLogger.error('email_send_failed', {
        status: response.status,
        error,
        alert_type: payload.type
      });
      return false;
    }

    alertLogger.info('email_alert_sent', {
      alert_type: payload.type,
      provider: payload.provider,
      location_id: payload.location_id,
      severity: payload.severity
    });
    return true;
  } catch (error) {
    alertLogger.error('email_send_error', error instanceof Error ? error : new Error(String(error)), {
      alert_type: payload.type
    });
    return false;
  }
}

// Convenience functions for specific Fudo alerts

export async function alertCircuitBreakerOpen(
  provider: string,
  locationId: string | null,
  failures: number,
  resumeAt?: string
): Promise<void> {
  const payload: AlertPayload = {
    type: 'circuit_breaker_open',
    provider,
    location_id: locationId || undefined,
    severity: 'error',
    title: `Circuit Breaker Opened - ${provider}`,
    message: locationId 
      ? `Circuit breaker opened for ${provider} at location ${locationId} due to ${failures} failures.`
      : `Global circuit breaker opened for ${provider} due to ${failures} failures.`,
    metadata: {
      failure_count: failures,
      resume_at: resumeAt,
      scope: locationId ? 'location' : 'global'
    }
  };

  await Promise.all([
    sendSlackAlert(payload),
    sendEmailAlert(payload)
  ]);
}

export async function alertRotationFailures(
  provider: string,
  locationId: string,
  consecutiveFailures: number,
  lastRotationId?: string,
  lastError?: string
): Promise<void> {
  const payload: AlertPayload = {
    type: 'rotation_failures',
    provider,
    location_id: locationId,
    severity: 'warn',
    title: `${consecutiveFailures} Consecutive Rotation Failures - ${provider}`,
    message: `Location ${locationId} has experienced ${consecutiveFailures} consecutive rotation failures.`,
    metadata: {
      consecutive_failures: consecutiveFailures,
      last_rotation_id: lastRotationId,
      last_error: lastError,
      threshold_reached: consecutiveFailures >= 3
    }
  };

  await Promise.all([
    sendSlackAlert(payload),
    sendEmailAlert(payload)
  ]);
}

export async function alertHealthcheckFailed(
  jobName: string,
  hoursOverdue: number,
  lastStatus?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const payload: AlertPayload = {
    type: 'healthcheck_failed',
    provider: 'system',
    severity: hoursOverdue > 24 ? 'critical' : 'error',
    title: `Healthcheck Failed - ${jobName}`,
    message: `Job ${jobName} is ${hoursOverdue.toFixed(1)} hours overdue.`,
    metadata: {
      job_name: jobName,
      hours_overdue: hoursOverdue,
      last_status: lastStatus,
      ...metadata
    }
  };

  await Promise.all([
    sendSlackAlert(payload),
    sendEmailAlert(payload)
  ]);
}