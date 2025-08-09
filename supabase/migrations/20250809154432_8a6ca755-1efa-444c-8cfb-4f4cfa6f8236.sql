-- Performance indexes for feature flags and POS integration
CREATE INDEX IF NOT EXISTS idx_entitlements_tenant_location 
  ON public.entitlements(tenant_id, location_id);

CREATE INDEX IF NOT EXISTS idx_pos_integrations_tenant_provider 
  ON public.pos_integrations(tenant_id, provider);
