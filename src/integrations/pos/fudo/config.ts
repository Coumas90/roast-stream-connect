/**
 * Centralized Fudo Configuration
 * 
 * Pattern: DB (pos_settings) → ENV → Defaults
 * Ensures consistency across chaos tests, alerts, and runtime
 */

import { supabase } from "../../supabase/client";

// Safe number conversion
const n = (v: any, def: number): number => (Number.isFinite(+v) ? +v : def);

// Cache for settings to avoid repeated DB calls
let settingsCache: Record<string, number> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30000; // 30 seconds

async function getPosSettingsCached(): Promise<Record<string, number>> {
  const now = Date.now();
  
  if (settingsCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return settingsCache;
  }

  try {
    const { data, error } = await supabase
      .from('pos_settings')
      .select('key, value')
      .ilike('key', 'fudo_%');

    if (error) {
      console.warn('Failed to load pos_settings, using defaults:', error.message);
      return {};
    }

    settingsCache = {};
    data?.forEach(setting => {
      settingsCache![setting.key] = setting.value;
    });
    
    cacheTimestamp = now;
    return settingsCache;
  } catch (err) {
    console.warn('Error loading pos_settings:', err);
    return {};
  }
}

export interface FudoConfig {
  readonly API_TIMEOUT_MS: number;
  readonly MAX_RETRIES: number;
  readonly BACKOFF_MS: number;
  readonly CB_THRESHOLD: number;
  readonly RPM_LIMIT: number;
  readonly ROTATION_COOLDOWN_HOURS: number;
  readonly TOKEN_EXPIRY_BUFFER_HOURS: number;
}

/**
 * Load Fudo configuration with governance pattern
 * Priority: DB settings → ENV vars → Safe defaults
 */
export async function loadFudoConfig(): Promise<FudoConfig> {
  const dbSettings = await getPosSettingsCached();
  
  const config = {
    // API Communication (aligned with edge function timeouts)
    API_TIMEOUT_MS: n(
      process.env.FUDO_API_TIMEOUT_MS, 
      n(dbSettings.fudo_api_timeout_ms, 30000)
    ),
    
    // Retry Strategy (aligned with chaos tests)
    MAX_RETRIES: n(
      process.env.FUDO_MAX_RETRIES,
      n(dbSettings.fudo_max_retries, 2)
    ),
    
    BACKOFF_MS: n(
      process.env.FUDO_BACKOFF_MS,
      n(dbSettings.fudo_backoff_ms, 1000)
    ),
    
    // Circuit Breaker (aligned with existing CB logic)
    CB_THRESHOLD: n(
      process.env.FUDO_CB_THRESHOLD,
      n(dbSettings.fudo_cb_threshold, 10)
    ),
    
    // Rate Limiting
    RPM_LIMIT: n(
      process.env.FUDO_RPM_LIMIT,
      n(dbSettings.fudo_rpm_limit, 60)
    ),
    
    // Token Management (aligned with rotation frequency)
    ROTATION_COOLDOWN_HOURS: n(
      process.env.FUDO_ROTATION_COOLDOWN_HOURS,
      n(dbSettings.fudo_rotation_cooldown_hours, 4)
    ),
    
    TOKEN_EXPIRY_BUFFER_HOURS: n(
      process.env.FUDO_TOKEN_EXPIRY_BUFFER_HOURS,
      n(dbSettings.fudo_token_expiry_buffer_hours, 24)
    ),
  } as const;

  // Log config for audit trail (without sensitive values)
  console.log('Fudo config loaded:', {
    source: 'DB+ENV+defaults',
    timeout_ms: config.API_TIMEOUT_MS,
    max_retries: config.MAX_RETRIES,
    cb_threshold: config.CB_THRESHOLD,
    rpm_limit: config.RPM_LIMIT,
  });

  return config;
}

// Default config for synchronous access (fallback only)
export const DEFAULT_FUDO_CONFIG: FudoConfig = {
  API_TIMEOUT_MS: 30000,
  MAX_RETRIES: 2,
  BACKOFF_MS: 1000,
  CB_THRESHOLD: 10,
  RPM_LIMIT: 60,
  ROTATION_COOLDOWN_HOURS: 4,
  TOKEN_EXPIRY_BUFFER_HOURS: 24,
} as const;