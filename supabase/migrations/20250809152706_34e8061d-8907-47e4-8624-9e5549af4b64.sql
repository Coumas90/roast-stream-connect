-- Performance indexes for flags and POS integration
create index if not exists idx_entitlements_tenant_location on public.entitlements(tenant_id, location_id);
create index if not exists idx_pos_integrations_tenant_provider on public.pos_integrations(tenant_id, provider);