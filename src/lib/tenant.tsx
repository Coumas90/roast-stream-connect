import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export type TenantContextType = {
  tenantId: string | null;
  locations: string[]; // location names for UI compatibility
  location: string; // selected location name
  locationId: string | null; // selected location id for data ops
  setLocation: (locName: string) => void;
  getLocationIdByName: (name: string) => string | undefined;
  isLoading: boolean;
  error: string | null;
  retryCount: number;
  isAuthenticated: boolean;
  authStatus: any;
};

const TenantContext = createContext<TenantContextType | undefined>(undefined);
const TENANT_KEY = "tupa_tenant_ctx";

type LocationRecord = { id: string; name: string; tenant_id: string };

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [allLocations, setAllLocations] = useState<LocationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authStatus, setAuthStatus] = useState<any>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const maxRetries = 3;
  
  const [location, setLocationState] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(TENANT_KEY);
      if (raw) return JSON.parse(raw).location as string;
    } catch {}
    return "";
  });

  const getLocationIdByName = (name: string) => allLocations.find((l) => l.name === name)?.id;

  const checkAuthStatus = async () => {
    try {
      const { data: authData, error: authError } = await supabase.rpc('get_auth_status');
      
      if (authError) {
        logger.warn('[TenantProvider] Auth status check failed', { error: authError.message });
        setIsAuthenticated(false);
        setAuthStatus(null);
        return false;
      }
      
      const parsedAuthData = authData as any;
      setAuthStatus(parsedAuthData);
      setIsAuthenticated(parsedAuthData?.authenticated || false);
      
      logger.info('[TenantProvider] Auth status checked', {
        authenticated: parsedAuthData?.authenticated,
        rolesCount: parsedAuthData?.roles_count,
        isAdmin: parsedAuthData?.is_admin
      });
      
      return parsedAuthData?.authenticated || false;
    } catch (error) {
      logger.error('[TenantProvider] Auth status check error', { error });
      setIsAuthenticated(false);
      setAuthStatus(null);
      return false;
    }
  };

  const fetchLocations = async (attempt = 0) => {
    const startTime = performance.now();
    
    try {
      setIsLoading(true);
      setError(null);
      
      logger.info('[TenantProvider] Starting location fetch', {
        attempt,
        component: 'TenantProvider',
        action: 'fetchLocations',
        authenticated: isAuthenticated
      });

      // Check auth status first
      const authResult = await checkAuthStatus();
      
      // Use the optimized function for location loading
      const { data, error } = await supabase.rpc('get_accessible_locations');

      const duration = performance.now() - startTime;

      if (error) {
        throw error;
      }

      const locs = (data ?? []) as LocationRecord[];
      setAllLocations(locs);
      setRetryCount(0);
      
      // Initialize selection if empty or invalid
      const names = locs.map((l) => l.name);
      if (!location || !names.includes(location)) {
        setLocationState(names[0] ?? "");
      }

      logger.info('[TenantProvider] Locations loaded successfully', {
        count: locs.length,
        duration,
        authenticated: authResult,
        component: 'TenantProvider'
      });

    } catch (err: any) {
      const duration = performance.now() - startTime;
      
      logger.error('[TenantProvider] Error fetching locations', {
        error: err.message,
        attempt,
        duration,
        code: err.code,
        component: 'TenantProvider'
      });

      setError(err.message || 'Error al cargar ubicaciones');

      // Retry logic with exponential backoff
      if (attempt < maxRetries) {
        const retryDelay = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10s delay
        
        logger.info('[TenantProvider] Scheduling retry', {
          attempt: attempt + 1,
          delay: retryDelay,
          component: 'TenantProvider'
        });

        setRetryCount(attempt + 1);
        
        retryTimeoutRef.current = window.setTimeout(() => {
          fetchLocations(attempt + 1);
        }, retryDelay);
      } else {
        logger.error('[TenantProvider] Max retries exceeded', {
          attempt,
          maxRetries,
          component: 'TenantProvider'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
    
    // Set up auth state listener to refresh locations when auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.info('[TenantProvider] Auth state changed', { 
          event, 
          authenticated: !!session,
          component: 'TenantProvider' 
        });
        
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          // Refresh locations when authentication state changes
          setTimeout(() => fetchLocations(), 100);
        }
      }
    );
    
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(TENANT_KEY, JSON.stringify({ location }));
  }, [location]);

  const setLocation = (locName: string) => setLocationState(locName);

  const selected = allLocations.find((l) => l.name === location) || null;
  const tenantId = selected?.tenant_id ?? null;
  const locationId = selected?.id ?? null;

  const value = useMemo(
    () => ({
      tenantId,
      locations: allLocations.map((l) => l.name),
      location,
      locationId,
      setLocation,
      getLocationIdByName,
      isLoading,
      error,
      retryCount,
      isAuthenticated,
      authStatus,
    }),
    [tenantId, allLocations, location, locationId, isLoading, error, retryCount, isAuthenticated, authStatus]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
