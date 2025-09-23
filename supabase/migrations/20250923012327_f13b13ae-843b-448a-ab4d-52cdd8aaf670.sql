-- Fix Security Definer Views/Functions Issue
-- Replace SECURITY DEFINER functions with proper RLS-based access control

-- 1. Fix list_location_members function
-- Remove SECURITY DEFINER and restructure to work with RLS
CREATE OR REPLACE FUNCTION public.list_location_members(_location_id uuid)
 RETURNS TABLE(user_id uuid, role app_role, tenant_id uuid, location_id uuid, created_at timestamp with time zone, full_name text, email text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    ur.user_id,
    ur.role,
    ur.tenant_id,
    ur.location_id,
    ur.created_at,
    p.full_name,
    p.id::text as email  -- Use profile ID as placeholder for email since auth.users is not accessible
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.location_id = _location_id
    AND (
      public.is_tupa_admin()
      OR public.user_has_location(_location_id)
    )
  ORDER BY ur.created_at ASC;
$function$;

-- 2. Fix list_location_invitations function  
-- Remove SECURITY DEFINER as it's not needed - invitations table has proper RLS
CREATE OR REPLACE FUNCTION public.list_location_invitations(_location_id uuid)
 RETURNS TABLE(id uuid, email text, role app_role, tenant_id uuid, location_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, expires_at timestamp with time zone, accepted_at timestamp with time zone, created_by uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
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

-- 3. Add email field to profiles table for proper user data management
-- This eliminates the need to access auth.users directly
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email text;

-- 4. Create trigger to sync email from auth.users to profiles
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Update profile email when auth.users email changes
  UPDATE public.profiles 
  SET email = NEW.email
  WHERE id = NEW.id;
  
  -- If no profile exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id, 
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
    )
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create trigger on auth.users to sync email changes
DROP TRIGGER IF EXISTS sync_profile_email_trigger ON auth.users;
CREATE TRIGGER sync_profile_email_trigger
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email();

-- 6. Update existing profiles with email data (one-time sync)
-- This requires SECURITY DEFINER but only for this migration
DO $$
DECLARE
  user_record RECORD;
BEGIN
  -- Sync existing users' emails to profiles
  FOR user_record IN 
    SELECT id, email, raw_user_meta_data
    FROM auth.users 
  LOOP
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      user_record.id,
      user_record.email,
      COALESCE(user_record.raw_user_meta_data->>'full_name', user_record.raw_user_meta_data->>'name')
    )
    ON CONFLICT (id) DO UPDATE SET 
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  END LOOP;
END $$;

-- 7. Now update list_location_members to use email from profiles
CREATE OR REPLACE FUNCTION public.list_location_members(_location_id uuid)
 RETURNS TABLE(user_id uuid, role app_role, tenant_id uuid, location_id uuid, created_at timestamp with time zone, full_name text, email text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    ur.user_id,
    ur.role,
    ur.tenant_id,
    ur.location_id,
    ur.created_at,
    p.full_name,
    p.email
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.location_id = _location_id
    AND (
      public.is_tupa_admin()
      OR public.user_has_location(_location_id)
    )
  ORDER BY ur.created_at ASC;
$function$;