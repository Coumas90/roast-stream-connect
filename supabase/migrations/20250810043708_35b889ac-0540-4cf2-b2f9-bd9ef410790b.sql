-- Create consumptions table if it does not exist
CREATE TABLE IF NOT EXISTS public.consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  location_id uuid NOT NULL,
  provider text NOT NULL,
  date date NOT NULL,
  total numeric NOT NULL DEFAULT 0,
  orders integer NOT NULL DEFAULT 0,
  items integer NOT NULL DEFAULT 0,
  discounts numeric NOT NULL DEFAULT 0,
  taxes numeric NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique index for idempotent upserts
CREATE UNIQUE INDEX IF NOT EXISTS uniq_consumption
ON public.consumptions (client_id, location_id, provider, date);

-- Enable RLS
ALTER TABLE public.consumptions ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for authorized users (by tenant or location) and admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'consumptions'
      AND policyname = 'consumptions_select_by_access'
  ) THEN
    EXECUTE $$
      CREATE POLICY consumptions_select_by_access
      ON public.consumptions
      FOR SELECT
      USING (
        public.is_tupa_admin()
        OR public.user_has_tenant(client_id)
        OR public.user_has_location(location_id)
      )
    $$;
  END IF;
END$$;

-- Do NOT allow INSERT/UPDATE/DELETE from anon users: these will be done via service role or RPCs
-- If in the future you want to allow writes, add explicit policies.

-- Attach updated_at trigger if helper function exists
DO $$
DECLARE
  v_has_func boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at' AND pg_function_is_visible(oid)
  ) INTO v_has_func;

  IF v_has_func AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_on_consumptions'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_on_consumptions
      BEFORE UPDATE ON public.consumptions
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at()';
  END IF;
END$$;