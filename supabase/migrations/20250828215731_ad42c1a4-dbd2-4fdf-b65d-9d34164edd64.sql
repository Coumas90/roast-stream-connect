-- Revert critical authorization functions to SECURITY DEFINER
-- These functions are used in RLS policies and MUST have elevated privileges

CREATE OR REPLACE FUNCTION public.is_tupa_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
 SET statement_timeout TO '3s'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'tupa_admin'::public.app_role
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
 SET statement_timeout TO '3s'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
  );
$function$;

CREATE OR REPLACE FUNCTION public.user_has_location(_location_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
 SET statement_timeout TO '5s'
AS $function$
  -- Fast path for admin users
  SELECT CASE 
    WHEN public.has_role(auth.uid(), 'tupa_admin'::public.app_role) THEN true
    ELSE (
      -- Direct location access
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() 
          AND ur.location_id = _location_id
      )
      OR 
      -- Tenant-level access with owner/manager role
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        INNER JOIN public.locations l ON l.tenant_id = ur.tenant_id
        WHERE ur.user_id = auth.uid()
          AND l.id = _location_id
          AND ur.role IN ('owner'::public.app_role, 'manager'::public.app_role)
      )
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.user_has_tenant(_tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
 SET statement_timeout TO '3s'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = _tenant_id
  ) OR public.is_tupa_admin();
$function$;

CREATE OR REPLACE FUNCTION public.user_can_manage_pos(_location_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
 SET statement_timeout TO '5s'
AS $function$
  SELECT public.is_tupa_admin() OR (
    public.user_has_location(_location_id) AND (
      public.has_role(auth.uid(), 'owner'::public.app_role) OR 
      public.has_role(auth.uid(), 'manager'::public.app_role)
    )
  );
$function$;