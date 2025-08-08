import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TenantContextType = {
  tenantId: string | null;
  locations: string[]; // location names for UI compatibility
  location: string; // selected location name
  locationId: string | null; // selected location id for data ops
  setLocation: (locName: string) => void;
  getLocationIdByName: (name: string) => string | undefined;
};

const TenantContext = createContext<TenantContextType | undefined>(undefined);
const TENANT_KEY = "tupa_tenant_ctx";

type LocationRecord = { id: string; name: string; tenant_id: string };

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [allLocations, setAllLocations] = useState<LocationRecord[]>([]);
  const [location, setLocationState] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(TENANT_KEY);
      if (raw) return JSON.parse(raw).location as string;
    } catch {}
    return "";
  });

  const getLocationIdByName = (name: string) => allLocations.find((l) => l.name === name)?.id;

  useEffect(() => {
    const sub = supabase
      .from("locations")
      .select("id,name,tenant_id")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.log("[Tenant] error fetching locations:", error);
          setAllLocations([]);
          return;
        }
        const locs = (data ?? []) as LocationRecord[];
        setAllLocations(locs);
        // Initialize selection if empty or invalid
        const names = locs.map((l) => l.name);
        if (!location || !names.includes(location)) {
          setLocationState(names[0] ?? "");
        }
      });
    return () => {
      // no realtime on locations here
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
    }),
    [tenantId, allLocations, location, locationId]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
