import { supabase } from "@/integrations/supabase/client";
import type { AppPosProvider } from "@/integrations/supabase/pos-types";

/**
 * Fudo-specific metrics collector for 401 handling and token rotation telemetry
 */
export class FudoMetrics {
  private static instance: FudoMetrics;
  
  static getInstance(): FudoMetrics {
    if (!FudoMetrics.instance) {
      FudoMetrics.instance = new FudoMetrics();
    }
    return FudoMetrics.instance;
  }

  /**
   * Record a metric event with structured attributes
   */
  async increment(metric: string, attrs: Record<string, any> = {}): Promise<void> {
    const timestamp = new Date().toISOString();
    
    // Log to console for immediate debugging
    console.log(`[FUDO_METRIC] ${metric}`, {
      ...attrs,
      timestamp
    });

    // Log to pos_logs table for persistent telemetry
    try {
      await supabase.from('pos_logs').insert({
        level: this.getLogLevel(metric),
        scope: 'fudo_metrics',
        message: `Metric: ${metric}`,
        location_id: attrs.location_id || null,
        provider: 'fudo' as AppPosProvider,
        meta: {
          metric_name: metric,
          ...attrs,
          timestamp
        }
      });
    } catch (error) {
      console.error('Failed to log Fudo metric to database:', error);
      // Don't throw - metrics shouldn't break business logic
    }
  }

  /**
   * Batch increment multiple metrics atomically
   */
  async incrementBatch(metrics: Array<{ metric: string; attrs?: Record<string, any> }>): Promise<void> {
    const timestamp = new Date().toISOString();
    
    try {
      const logEntries = metrics.map(({ metric, attrs = {} }) => ({
        level: this.getLogLevel(metric),
        scope: 'fudo_metrics',
        message: `Metric: ${metric}`,
        location_id: attrs.location_id || null,
        provider: 'fudo' as AppPosProvider,
        meta: {
          metric_name: metric,
          ...attrs,
          timestamp
        }
      }));

      // Process entries one by one to handle batch size limits
      for (const entry of logEntries) {
        await supabase.from('pos_logs').insert(entry);
      }
      
      // Also log to console
      metrics.forEach(({ metric, attrs = {} }) => {
        console.log(`[FUDO_METRIC] ${metric}`, { ...attrs, timestamp });
      });
    } catch (error) {
      console.error('Failed to log Fudo metrics batch to database:', error);
      // Fallback to individual console logs
      metrics.forEach(({ metric, attrs = {} }) => {
        console.log(`[FUDO_METRIC] ${metric}`, { ...attrs, timestamp });
      });
    }
  }

  /**
   * Create a fingerprint of sensitive data for logging (never log actual tokens)
   */
  createTokenFingerprint(token: string): string {
    if (!token) return 'empty';
    
    // Create a simple fingerprint: first 4 + last 4 chars + length
    const start = token.slice(0, 4);
    const end = token.slice(-4);
    return `${start}...${end}(${token.length})`;
  }

  /**
   * Map metric names to appropriate log levels
   */
  private getLogLevel(metric: string): string {
    if (metric.includes('failed') || metric.includes('error')) {
      return 'error';
    }
    if (metric.includes('401') || metric.includes('retry')) {
      return 'warn';
    }
    return 'info';
  }
}

/**
 * Convenience function for common Fudo metrics
 */
export const fudoMetrics = FudoMetrics.getInstance();