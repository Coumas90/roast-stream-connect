-- ============================================================================
-- MIGRATION: Create read-only table for barista hopper information
-- ============================================================================
-- Purpose: Allow baristas to view hopper stock information without exposing
--          sensitive data like prices
-- ============================================================================

-- 1. Create read-only table that mirrors location_stock but joins coffee details
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.location_stock_readonly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  coffee_variety_id uuid NOT NULL,
  hopper_number integer NOT NULL,
  current_kg numeric NOT NULL,
  last_refill_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Coffee variety fields (denormalized for read access)
  coffee_id uuid,
  coffee_name text,
  coffee_category text,
  coffee_image_url text,
  coffee_origin text,
  coffee_description text,
  coffee_specifications jsonb
);

-- 2. Enable RLS on the table
-- ============================================================================
ALTER TABLE public.location_stock_readonly ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policy for read-only access (all authenticated users in location)
-- ============================================================================
CREATE POLICY "location_stock_readonly_select_by_location"
ON public.location_stock_readonly
FOR SELECT
USING (
  user_has_location(location_id) OR is_tupa_admin()
);

-- 4. Create trigger function to sync data from location_stock
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_location_stock_readonly()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- On INSERT or UPDATE of location_stock, upsert to readonly table
  INSERT INTO public.location_stock_readonly (
    id,
    location_id,
    coffee_variety_id,
    hopper_number,
    current_kg,
    last_refill_at,
    notes,
    created_at,
    updated_at,
    coffee_id,
    coffee_name,
    coffee_category,
    coffee_image_url,
    coffee_origin,
    coffee_description,
    coffee_specifications
  )
  SELECT 
    ls.id,
    ls.location_id,
    ls.coffee_variety_id,
    ls.hopper_number,
    ls.current_kg,
    ls.last_refill_at,
    ls.notes,
    ls.created_at,
    ls.updated_at,
    cv.id,
    cv.name,
    cv.category,
    cv.image_url,
    cv.origin,
    cv.description,
    cv.specifications
  FROM (SELECT NEW.*) ls
  JOIN public.coffee_varieties cv ON ls.coffee_variety_id = cv.id
  ON CONFLICT (id) DO UPDATE SET
    location_id = EXCLUDED.location_id,
    coffee_variety_id = EXCLUDED.coffee_variety_id,
    hopper_number = EXCLUDED.hopper_number,
    current_kg = EXCLUDED.current_kg,
    last_refill_at = EXCLUDED.last_refill_at,
    notes = EXCLUDED.notes,
    updated_at = EXCLUDED.updated_at,
    coffee_id = EXCLUDED.coffee_id,
    coffee_name = EXCLUDED.coffee_name,
    coffee_category = EXCLUDED.coffee_category,
    coffee_image_url = EXCLUDED.coffee_image_url,
    coffee_origin = EXCLUDED.coffee_origin,
    coffee_description = EXCLUDED.coffee_description,
    coffee_specifications = EXCLUDED.coffee_specifications;
    
  RETURN NEW;
END;
$$;

-- 5. Create trigger on location_stock to sync to readonly table
-- ============================================================================
DROP TRIGGER IF EXISTS sync_to_readonly ON public.location_stock;

CREATE TRIGGER sync_to_readonly
AFTER INSERT OR UPDATE ON public.location_stock
FOR EACH ROW
EXECUTE FUNCTION public.sync_location_stock_readonly();

-- 6. Create trigger for DELETE to sync deletion
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_location_stock_readonly()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.location_stock_readonly WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS delete_from_readonly ON public.location_stock;

CREATE TRIGGER delete_from_readonly
AFTER DELETE ON public.location_stock
FOR EACH ROW
EXECUTE FUNCTION public.delete_location_stock_readonly();

-- 7. Populate readonly table with existing data
-- ============================================================================
INSERT INTO public.location_stock_readonly (
  id,
  location_id,
  coffee_variety_id,
  hopper_number,
  current_kg,
  last_refill_at,
  notes,
  created_at,
  updated_at,
  coffee_id,
  coffee_name,
  coffee_category,
  coffee_image_url,
  coffee_origin,
  coffee_description,
  coffee_specifications
)
SELECT 
  ls.id,
  ls.location_id,
  ls.coffee_variety_id,
  ls.hopper_number,
  ls.current_kg,
  ls.last_refill_at,
  ls.notes,
  ls.created_at,
  ls.updated_at,
  cv.id,
  cv.name,
  cv.category,
  cv.image_url,
  cv.origin,
  cv.description,
  cv.specifications
FROM public.location_stock ls
JOIN public.coffee_varieties cv ON ls.coffee_variety_id = cv.id
ON CONFLICT (id) DO NOTHING;

-- 8. Log security change
-- ============================================================================
INSERT INTO public.pos_logs (level, scope, message, meta)
VALUES (
  'info',
  'security',
  'Created read-only table for barista hopper stock access',
  jsonb_build_object(
    'table_name', 'location_stock_readonly',
    'excluded_fields', ARRAY['price_per_kg'],
    'roles_with_access', ARRAY['barista', 'coffee_master', 'manager', 'owner', 'tupa_admin'],
    'sync_mechanism', 'triggers',
    'migration_timestamp', now()
  )
);