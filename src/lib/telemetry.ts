import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

/**
 * Telemetry system for calibration metrics
 * Tracks: time to approval, revisions, success rates, etc.
 */

// Validation schemas
const CalibrationEventSchema = z.object({
  event_type: z.enum([
    'calibration_started',
    'calibration_saved',
    'calibration_approved',
    'calibration_duplicated',
    'calibration_reverted',
    'calibration_deleted',
  ]),
  calibration_id: z.string().uuid().optional(),
  coffee_profile_id: z.string().uuid(),
  location_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type CalibrationEvent = z.infer<typeof CalibrationEventSchema>;

const CalibrationMetricsSchema = z.object({
  calibration_id: z.string().uuid(),
  time_to_approval_seconds: z.number().int().positive().optional(),
  revision_count: z.number().int().min(0),
  grind_adjustments: z.number().int().min(0),
  initial_semaphore_status: z.enum(['success', 'warning', 'error']),
  final_semaphore_status: z.enum(['success', 'warning', 'error']),
  notes_length: z.number().int().min(0).max(5000),
  tags_count: z.number().int().min(0).max(20),
});

export type CalibrationMetrics = z.infer<typeof CalibrationMetricsSchema>;

/**
 * Log a calibration event for telemetry
 */
export async function logCalibrationEvent(event: CalibrationEvent): Promise<boolean> {
  try {
    // Validate input
    const validatedEvent = CalibrationEventSchema.parse(event);

    // Store in pos_logs table (reusing existing infrastructure)
    const { error } = await supabase.from('pos_logs').insert({
      level: 'info',
      scope: 'calibration_telemetry',
      message: `Calibration event: ${validatedEvent.event_type}`,
      location_id: validatedEvent.location_id,
      meta: {
        event_type: validatedEvent.event_type,
        calibration_id: validatedEvent.calibration_id,
        coffee_profile_id: validatedEvent.coffee_profile_id,
        tenant_id: validatedEvent.tenant_id,
        user_id: validatedEvent.user_id,
        timestamp: new Date().toISOString(),
        ...validatedEvent.metadata,
      },
    });

    if (error) {
      console.error('Failed to log calibration event:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Telemetry validation error:', error);
    return false;
  }
}

/**
 * Calculate metrics for a calibration session
 */
export function calculateCalibrationMetrics(params: {
  startTime: Date;
  endTime: Date;
  revisionCount: number;
  grindAdjustments: number;
  initialStatus: 'success' | 'warning' | 'error';
  finalStatus: 'success' | 'warning' | 'error';
  notesText: string;
  tags: string[];
}): Omit<CalibrationMetrics, 'calibration_id'> {
  const timeToApprovalSeconds = Math.floor(
    (params.endTime.getTime() - params.startTime.getTime()) / 1000
  );

  return {
    time_to_approval_seconds: timeToApprovalSeconds,
    revision_count: Math.max(0, params.revisionCount),
    grind_adjustments: Math.max(0, params.grindAdjustments),
    initial_semaphore_status: params.initialStatus,
    final_semaphore_status: params.finalStatus,
    notes_length: Math.min(params.notesText.length, 5000),
    tags_count: Math.min(params.tags.length, 20),
  };
}

/**
 * Get telemetry summary for a location
 */
export async function getCalibrationTelemetry(locationId: string, days: number = 30) {
  try {
    const { data, error } = await supabase
      .from('pos_logs')
      .select('*')
      .eq('scope', 'calibration_telemetry')
      .eq('location_id', locationId)
      .gte('ts', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('ts', { ascending: false });

    if (error) {
      console.error('Failed to fetch telemetry:', error);
      return null;
    }

    // Aggregate metrics
    const events = data || [];
    const summary = {
      total_events: events.length,
      by_type: {} as Record<string, number>,
      avg_time_to_approval: 0,
      total_reversions: 0,
      success_rate: 0,
    };

    let totalTimeToApproval = 0;
    let approvalCount = 0;

    events.forEach((event) => {
      const meta = event.meta as Record<string, any> | null;
      const eventType = meta?.event_type as string | undefined;
      
      if (eventType) {
        summary.by_type[eventType] = (summary.by_type[eventType] || 0) + 1;

        if (eventType === 'calibration_approved') {
          approvalCount++;
          const timeToApproval = meta?.time_to_approval_seconds;
          if (typeof timeToApproval === 'number') {
            totalTimeToApproval += timeToApproval;
          }
        }

        if (eventType === 'calibration_reverted') {
          summary.total_reversions++;
        }
      }
    });

    if (approvalCount > 0) {
      summary.avg_time_to_approval = Math.round(totalTimeToApproval / approvalCount);
      summary.success_rate = Math.round(
        (approvalCount / (summary.by_type['calibration_saved'] || 1)) * 100
      );
    }

    return summary;
  } catch (error) {
    console.error('Error fetching telemetry:', error);
    return null;
  }
}

/**
 * Track session timing
 */
export class CalibrationSession {
  private startTime: Date;
  private revisionCount: number = 0;
  private grindAdjustments: number = 0;
  private initialStatus?: 'success' | 'warning' | 'error';
  private lastGrindValue?: number;

  constructor() {
    this.startTime = new Date();
  }

  recordRevision() {
    this.revisionCount++;
  }

  recordGrindAdjustment(newValue: number) {
    if (this.lastGrindValue !== undefined && this.lastGrindValue !== newValue) {
      this.grindAdjustments++;
    }
    this.lastGrindValue = newValue;
  }

  setInitialStatus(status: 'success' | 'warning' | 'error') {
    if (!this.initialStatus) {
      this.initialStatus = status;
    }
  }

  getMetrics(
    finalStatus: 'success' | 'warning' | 'error',
    notesText: string,
    tags: string[]
  ): Omit<CalibrationMetrics, 'calibration_id'> {
    return calculateCalibrationMetrics({
      startTime: this.startTime,
      endTime: new Date(),
      revisionCount: this.revisionCount,
      grindAdjustments: this.grindAdjustments,
      initialStatus: this.initialStatus || 'warning',
      finalStatus,
      notesText,
      tags,
    });
  }

  reset() {
    this.startTime = new Date();
    this.revisionCount = 0;
    this.grindAdjustments = 0;
    this.initialStatus = undefined;
    this.lastGrindValue = undefined;
  }
}
