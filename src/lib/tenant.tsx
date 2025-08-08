import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type TenantContextType = {
  tenantId: string;
  locations: string[];
  location: string;
  setLocation: (loc: string) => void;
};

const TenantContext = createContext<TenantContextType | undefined>(undefined);
const TENANT_KEY = "tupa_tenant_ctx";

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenantId] = useState("demo-tenant");
  const [locations] = useState<string[]>(["Palermo", "Caballito", "Microcentro"]);
  const [location, setLocationState] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(TENANT_KEY);
      if (raw) return JSON.parse(raw).location as string;
    } catch {}
    return "Palermo";
  });

  useEffect(() => {
    localStorage.setItem(TENANT_KEY, JSON.stringify({ location }));
  }, [location]);

  const setLocation = (loc: string) => setLocationState(loc);

  const value = useMemo(() => ({ tenantId, locations, location, setLocation }), [tenantId, locations, location]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
