import type { POSAdapterFactory, POSConfig, POSMeta, POSService } from "../../../sdk/pos";

// Minimal registry scaffold. Real adapters can register their factories here in the future.

const META: POSMeta[] = [
  { id: "fudo", label: "Fudo", kindsSupported: ["orders", "products"], website: "https://fudo.com/" },
  { id: "maxirest", label: "MaxiRest", kindsSupported: ["orders", "products"], website: "https://maxirest.com/" },
  { id: "bistrosoft", label: "Bistrosoft", kindsSupported: ["orders", "products"], website: "https://bistrosoft.com/" },
  { id: "other", label: "Otro / Custom", kindsSupported: ["orders" ] },
];

export function getAvailablePOSTypes(): POSMeta[] {
  // Dummy meta for acceptance; will be dynamic when adapters are plugged in
  return META;
}

export function getPOSAdapter(provider: string, config: POSConfig, factoryOverride?: POSAdapterFactory): POSService {
  // For now, only allow an explicit override factory (used in tests or callers providing their own adapter)
  if (factoryOverride) return factoryOverride(config);
  throw new Error(`No adapter factory registered for provider '${provider}'`);
}
