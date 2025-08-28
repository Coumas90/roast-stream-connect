-- =============================================================================
-- SECURITY FIX: Convert SECURITY DEFINER view-like functions to SECURITY INVOKER
-- =============================================================================

-- CRITICAL: These functions act like views but use SECURITY DEFINER, 
-- which bypasses user-specific RLS policies. Converting to SECURITY INVOKER
-- ensures proper access control.

-- 1. Fix get_accessible_locations (most critical - bypasses location access control)
CREATE OR REPLACE FUNCTION public.get_accessible_locations()
RETURNS TABLE(id uuid, name text, tenant_id uuid, code text, timezone text, created_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '8s'
AS $function$
DECLARE
  current_user_id uuid;
  is_admin boolean := false;
BEGIN
  -- Get current user safely
  current_user_id := auth.uid();
  
  -- Check if user is admin (fast check)
  IF current_user_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = current_user_id 
        AND ur.role = 'tupa_admin'::public.app_role
    ) INTO is_admin;
  END IF;
  
  -- If admin, return all locations
  IF is_admin THEN
    RETURN QUERY
    SELECT l.id, l.name, l.tenant_id, l.code, l.timezone, l.created_at
    FROM public.locations l
    ORDER BY l.name ASC;
    RETURN;
  END IF;
  
  -- If not authenticated, return empty set (will be handled by UI)
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;
  
  -- For authenticated non-admin users, get their accessible locations
  RETURN QUERY
  SELECT DISTINCT l.id, l.name, l.tenant_id, l.code, l.timezone, l.created_at
  FROM public.locations l
  WHERE EXISTS (
    -- Direct location access
    SELECT 1 FROM public.user_roles ur1
    WHERE ur1.user_id = current_user_id 
      AND ur1.location_id = l.id
  ) OR EXISTS (
    -- Tenant-level access (owner/manager)
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = current_user_id
      AND ur2.tenant_id = l.tenant_id
      AND ur2.role IN ('owner'::public.app_role, 'manager'::public.app_role)
  )
  ORDER BY l.name ASC;
END;
$function$;

-- 2. Fix pos_credentials_public view function
CREATE OR REPLACE FUNCTION public.get_pos_credentials_public()
RETURNS TABLE(id uuid, location_id uuid, provider app_pos_provider, created_at timestamp with time zone, updated_at timestamp with time zone, status text, rotation_status text, credential_status text, rotation_status_display text)
LANGUAGE sql
STABLE SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    pc.id,
    pc.location_id,
    pc.provider,
    pc.created_at,
    pc.updated_at,
    pc.status,
    pc.rotation_status,
    CASE
      WHEN pc.secret_ref IS NOT NULL THEN 'CONFIGURED'::text
      ELSE 'NOT_CONFIGURED'::text
    END AS credential_status,
    CASE
      WHEN pc.last_rotation_at > (now() - interval '24 hours') THEN 'RECENT'::text
      WHEN pc.last_rotation_at IS NULL THEN 'NEVER'::text
      ELSE 'STALE'::text
    END AS rotation_status_display
  FROM public.pos_credentials pc
  WHERE public.user_has_location(pc.location_id) OR public.is_tupa_admin();
$function$;

-- 3. Fix pos_security_audit_summary view function  
CREATE OR REPLACE FUNCTION public.pos_security_audit_summary()
RETURNS TABLE(location_id uuid, provider app_pos_provider, access_count bigint, last_access timestamp with time zone, unique_users bigint)
LANGUAGE sql
STABLE SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    pl.location_id,
    pl.provider,
    COUNT(*) as access_count,
    MAX(pl.ts) as last_access,
    COUNT(DISTINCT (pl.meta->>'user_id')) as unique_users
  FROM public.pos_logs pl
  WHERE pl.scope = 'security_audit'
    AND pl.location_id IS NOT NULL
    AND (is_tupa_admin() OR user_has_location(pl.location_id))
  GROUP BY pl.location_id, pl.provider
  ORDER BY last_access DESC;
$function$;

-- 4. Fix pos_credentials_expiring_soon view function
CREATE OR REPLACE FUNCTION public.pos_credentials_expiring_soon(days_ahead integer DEFAULT 3)
RETURNS TABLE(location_id uuid, provider app_pos_provider, status text, issued_at timestamp with time zone, expires_at timestamp with time zone, days_until_expiry integer, last_rotation_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT 
      pc.location_id,
      pc.provider,
      pc.status,
      pc.issued_at,
      pc.expires_at,
      EXTRACT(days FROM (pc.expires_at - now()))::INTEGER AS days_until_expiry,
      pc.last_rotation_at
    FROM public.pos_credentials pc
    WHERE pc.expires_at IS NOT NULL
      AND pc.expires_at <= (now() + make_interval(days => days_ahead))
      AND (is_tupa_admin() OR user_has_location(pc.location_id))
    ORDER BY pc.expires_at ASC;
$function$;

-- 5. Fix list_location_members view function
CREATE OR REPLACE FUNCTION public.list_location_members(_location_id uuid)
RETURNS TABLE(user_id uuid, role app_role, tenant_id uuid, location_id uuid, created_at timestamp with time zone, full_name text, email text)
LANGUAGE sql
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select
    ur.user_id,
    ur.role,
    ur.tenant_id,
    ur.location_id,
    ur.created_at,
    p.full_name,
    au.email
  from public.user_roles ur
  left join public.profiles p on p.id = ur.user_id
  left join auth.users au on au.id = ur.user_id
  where ur.location_id = _location_id
    and (
      public.is_tupa_admin()
      or public.user_has_location(_location_id)
    )
  order by ur.created_at asc
$function$;

-- Log the security fix
INSERT INTO public.pos_logs (level, scope, message, meta)
VALUES (
  'info',
  'security_fix',
  'Converted SECURITY DEFINER view-like functions to SECURITY INVOKER',
  jsonb_build_object(
    'fixed_functions', ARRAY[
      'get_accessible_locations',
      'get_pos_credentials_public', 
      'pos_security_audit_summary',
      'pos_credentials_expiring_soon',
      'list_location_members'
    ],
    'timestamp', now(),
    'security_issue', 'security_definer_view'
  )
);