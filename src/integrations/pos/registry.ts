import type { POSAdapterFactory, POSConfig, POSMeta, POSService } from "../../../sdk/pos";
import { fudoFactory } from "./fudo/service";
import { bistrosoftFactory } from "./bistrosoft/service";

// Registered factories per provider
const factories = {
  fudo: fudoFactory,
  bistrosoft: bistrosoftFactory,
} as const;

type ProviderId = keyof typeof factories;

const META: Record<ProviderId, POSMeta> = {
  fudo: {
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
  bistrosoft: {
    id: "bistrosoft",
    label: "Bistrosoft POS",
    name: "Bistrosoft POS",
    version: "1.0.0",
    kindsSupported: ["orders"],
    website: "https://bistrosoft.com/",
    batchLimit: 500,
    realtime: false,
    capabilities: ["customers", "discounts", "tables"],
  },
} as const;

export function getAvailablePOSTypes(): POSMeta[] {
  return Object.values(META);
}

export function getPOSAdapter(provider: ProviderId, config: POSConfig, factoryOverride?: POSAdapterFactory): POSService {
  if (factoryOverride) return factoryOverride(config);
  const factory = factories[provider];
  if (factory) return factory(config);
  throw new Error(`No adapter factory registered for provider '${provider}'`);
}

