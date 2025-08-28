-- Fix team member loading by reverting functions that access auth schema to SECURITY DEFINER
-- These functions MUST be SECURITY DEFINER because they access auth.users table

CREATE OR REPLACE FUNCTION public.list_location_members(_location_id uuid)
 RETURNS TABLE(user_id uuid, role app_role, tenant_id uuid, location_id uuid, created_at timestamp with time zone, full_name text, email text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
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

CREATE OR REPLACE FUNCTION public.list_location_invitations(_location_id uuid)
 RETURNS TABLE(id uuid, email text, role app_role, tenant_id uuid, location_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, expires_at timestamp with time zone, accepted_at timestamp with time zone, created_by uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT
    i.id,
    i.email,
    i.role,
    i.tenant_id,
    i.location_id,
    i.created_at,
    i.updated_at,
    i.expires_at,
    i.accepted_at,
    i.created_by
  FROM public.invitations i
  WHERE i.location_id = _location_id
    AND (public.is_tupa_admin() OR public.user_has_location(_location_id))
    AND i.accepted_at IS NULL
  ORDER BY i.created_at DESC;
$function$;