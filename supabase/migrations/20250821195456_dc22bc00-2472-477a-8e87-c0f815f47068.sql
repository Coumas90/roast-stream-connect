-- Fix security definer view warnings for Card 13 dashboard views
-- Remove admin checks from views and handle security through RLS and access control

-- Drop existing views
DROP VIEW IF EXISTS public.pos_dashboard_expirations;
DROP VIEW IF EXISTS public.pos_dashboard_breakers;

-- Recreate views without is_tupa_admin() calls (remove security definer context)
CREATE VIEW public.pos_dashboard_expirations AS
SELECT 
  pc.location_id,
  pc.provider,
  pc.expires_at,
  EXTRACT(days FROM (pc.expires_at - now()))::integer AS days_until_expiry,
  EXTRACT(hours FROM (pc.expires_at - now()))::integer AS hours_until_expiry,
  pc.status,
  pc.rotation_status,
  pc.consecutive_rotation_failures,
  pc.last_rotation_at,
  l.name AS location_name,
  t.name AS tenant_name
FROM pos_credentials pc
JOIN locations l ON l.id = pc.location_id
JOIN tenants t ON t.id = l.tenant_id
WHERE pc.expires_at IS NOT NULL 
  AND pc.expires_at > now()
ORDER BY pc.expires_at;

CREATE VIEW public.pos_dashboard_breakers AS
SELECT 
  rcb.provider,
  rcb.location_id,
  rcb.state,
  rcb.failures,
  rcb.resume_at,
  rcb.window_start,
  rcb.updated_at,
  l.name AS location_name,
  t.name AS tenant_name,
  CASE 
    WHEN rcb.state = 'closed' THEN 'green'
    WHEN rcb.state = 'half-open' THEN 'amber'
    WHEN rcb.state = 'open' THEN 'red'
    ELSE 'unknown'
  END AS status_color
FROM rotation_cb rcb
LEFT JOIN locations l ON l.id = rcb.location_id
LEFT JOIN tenants t ON t.id = l.tenant_id
ORDER BY rcb.updated_at DESC;

-- Apply RLS to these views for security (admin-only access)
ALTER VIEW public.pos_dashboard_expirations SET (security_invoker = true);
ALTER VIEW public.pos_dashboard_breakers SET (security_invoker = true);

-- Grant access only to admin function (secure access pattern)
REVOKE ALL ON public.pos_dashboard_expirations FROM PUBLIC;
REVOKE ALL ON public.pos_dashboard_breakers FROM PUBLIC;

-- Access will be controlled through the edge function which uses admin privileges