-- POS permissions helper and hardened public RPC
-- Wrap REVOKE in IF EXISTS to be idempotent
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'user_can_manage_pos'
      AND n.nspname = 'public'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid'
  ) THEN
    REVOKE ALL ON FUNCTION public.user_can_manage_pos(uuid) FROM PUBLIC;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'pos_provider_credentials_public'
      AND n.nspname = 'public'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid'
  ) THEN
    REVOKE ALL ON FUNCTION public.pos_provider_credentials_public(uuid) FROM PUBLIC;
  END IF;
END $$;

-- Helper: can the current user manage POS for a specific location?
CREATE OR REPLACE FUNCTION public.user_can_manage_pos(_location_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  select
    public.is_tupa_admin()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.location_id = _location_id
        and ur.role in ('manager')
    )
    or exists (
      select 1
      from public.user_roles ur
      join public.locations l on l.tenant_id = ur.tenant_id
      where ur.user_id = auth.uid()
        and ur.role = 'owner'
        and l.id = _location_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_manage_pos(uuid) TO authenticated;

-- Harden the public function: use the helper (blocks masters)
CREATE OR REPLACE FUNCTION public.pos_provider_credentials_public(_location_id uuid)
RETURNS TABLE(
  location_id uuid,
  provider public.app_pos_provider,
  masked_hints jsonb,
  status text,
  last_verified_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  select
    c.location_id,
    c.provider,
    c.masked_hints,
    c.status,
    c.last_verified_at,
    c.updated_at
  from public.pos_provider_credentials c
  where c.location_id = _location_id
    and public.user_can_manage_pos(_location_id)
$$;

GRANT EXECUTE ON FUNCTION public.pos_provider_credentials_public(uuid) TO authenticated;