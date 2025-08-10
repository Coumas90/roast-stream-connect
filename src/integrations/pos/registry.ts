import type { POSAdapterFactory, POSConfig, POSMeta, POSService } from "../../../sdk/pos";
import { fudoFactory } from "./fudo/service";


// Registered factories per provider
const factories: Record<string, POSAdapterFactory> = {
  fudo: fudoFactory,
};

const META: POSMeta[] = [
  {
    id: "fudo",
    label: "Fudo POS",
    name: "Fudo POS",
    version: "1.0.0",
    kindsSupported: ["orders"],
    website: "https://fudo.com/",
    batchLimit: 1000,
    realtime: true,
    capabilities: ["customers", "modifiers", "tables", "realtime"],
  },
  { id: "maxirest", label: "MaxiRest", kindsSupported: ["orders", "products"], website: "https://maxirest.com/" },
  { id: "bistrosoft", label: "Bistrosoft", kindsSupported: ["orders", "products"], website: "https://bistrosoft.com/" },
  { id: "other", label: "Otro / Custom", kindsSupported: ["orders" ] },
];

export function getAvailablePOSTypes(): POSMeta[] {
  return META;
}

export function getPOSAdapter(provider: string, config: POSConfig, factoryOverride?: POSAdapterFactory): POSService {
  if (factoryOverride) return factoryOverride(config);
  const factory = factories[provider];
  if (factory) return factory(config);
  throw new Error(`No adapter factory registered for provider '${provider}'`);
}

