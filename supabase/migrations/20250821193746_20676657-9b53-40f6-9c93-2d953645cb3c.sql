-- Fix security issues from linter

-- Remove SECURITY DEFINER from view and replace with regular view
DROP VIEW IF EXISTS public.pos_dashboard_breakers;

CREATE VIEW public.pos_dashboard_breakers AS
SELECT 
  rcb.provider,
  rcb.location_id,
  rcb.state,
  rcb.failures,
  rcb.resume_at,
  rcb.window_start,
  rcb.updated_at,
  l.name as location_name,
  t.name as tenant_name,
  CASE 
    WHEN rcb.state = 'closed' THEN 'green'
    WHEN rcb.state = 'half-open' THEN 'amber'
    WHEN rcb.state = 'open' THEN 'red'
    ELSE 'unknown'
  END as status_color
FROM public.rotation_cb rcb
LEFT JOIN public.locations l ON l.id = rcb.location_id
LEFT JOIN public.tenants t ON t.id = l.tenant_id
WHERE is_tupa_admin() -- Apply RLS at view level
ORDER BY rcb.updated_at DESC;

-- Add RLS policy for materialized view access
ALTER MATERIALIZED VIEW public.pos_dashboard_expirations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_dashboard_expirations_admin_only" 
ON public.pos_dashboard_expirations 
FOR SELECT 
USING (is_tupa_admin());