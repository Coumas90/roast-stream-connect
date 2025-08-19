-- Fix the security issue with profiles table by making RLS policies more restrictive
-- Drop existing policies and recreate them with proper authentication checks

-- Drop existing policies
DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;

-- Recreate policies with explicit authentication requirement
CREATE POLICY "profiles_select_authenticated_self_or_admin" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  (auth.uid() IS NOT NULL) AND 
  ((id = auth.uid()) OR is_tupa_admin())
);

CREATE POLICY "profiles_insert_authenticated_self" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (
  (auth.uid() IS NOT NULL) AND 
  ((id = auth.uid()) OR is_tupa_admin())
);

CREATE POLICY "profiles_update_authenticated_self" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (
  (auth.uid() IS NOT NULL) AND 
  ((id = auth.uid()) OR is_tupa_admin())
)
WITH CHECK (
  (auth.uid() IS NOT NULL) AND 
  ((id = auth.uid()) OR is_tupa_admin())
);

-- Ensure no policy exists for anonymous users
-- This explicitly blocks any anonymous access
CREATE POLICY "profiles_block_anonymous" 
ON public.profiles 
FOR ALL 
TO anon
USING (false);

-- Add a comment explaining the security fix
COMMENT ON TABLE public.profiles IS 'User profiles table with strict RLS - only authenticated users can access their own data or admins can access all data. Anonymous access is explicitly blocked.';