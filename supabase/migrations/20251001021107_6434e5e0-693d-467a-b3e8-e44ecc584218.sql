-- Update RLS policies for calibration_entries to support recipe_id

-- Drop old insert policy that requires coffee_profile_id
DROP POLICY IF EXISTS "calibration_entries_insert_barista" ON calibration_entries;

-- Create new insert policy that works with either coffee_profile_id OR recipe_id
CREATE POLICY "calibration_entries_insert_barista" ON calibration_entries
FOR INSERT
WITH CHECK (
  auth.uid() = barista_id 
  AND (
    -- Allow if using coffee_profile (legacy)
    (coffee_profile_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM coffee_profiles cp
      WHERE cp.id = calibration_entries.coffee_profile_id
      AND user_has_location(cp.location_id)
    ))
    OR
    -- Allow if using recipe (new system)
    (recipe_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.id = calibration_entries.recipe_id
      AND user_has_tenant(r.tenant_id)
    ))
  )
);

-- Update select policy to support recipe_id
DROP POLICY IF EXISTS "calibration_entries_select_by_location" ON calibration_entries;

CREATE POLICY "calibration_entries_select_by_location" ON calibration_entries
FOR SELECT
USING (
  -- Allow if using coffee_profile (legacy)
  (coffee_profile_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM coffee_profiles cp
    WHERE cp.id = calibration_entries.coffee_profile_id
    AND (user_has_location(cp.location_id) OR is_tupa_admin())
  ))
  OR
  -- Allow if using recipe (new system)
  (recipe_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM recipes r
    WHERE r.id = calibration_entries.recipe_id
    AND (user_has_tenant(r.tenant_id) OR is_tupa_admin())
  ))
  OR
  is_tupa_admin()
);

-- Update update policy to support recipe_id
DROP POLICY IF EXISTS "calibration_entries_update_own_recent" ON calibration_entries;

CREATE POLICY "calibration_entries_update_own_recent" ON calibration_entries
FOR UPDATE
USING (
  (
    barista_id = auth.uid() 
    AND created_at > now() - interval '24 hours'
  )
  OR
  (
    -- Allow managers/owners to update entries in their locations/tenants
    (coffee_profile_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM coffee_profiles cp
      WHERE cp.id = calibration_entries.coffee_profile_id
      AND user_has_location(cp.location_id)
      AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
    ))
    OR
    (recipe_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.id = calibration_entries.recipe_id
      AND user_has_tenant(r.tenant_id)
      AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
    ))
  )
  OR
  is_tupa_admin()
);

-- Update delete policy to support recipe_id  
DROP POLICY IF EXISTS "calibration_entries_delete_manager" ON calibration_entries;

CREATE POLICY "calibration_entries_delete_manager" ON calibration_entries
FOR DELETE
USING (
  (
    -- Allow managers/owners to delete entries in their locations/tenants
    (coffee_profile_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM coffee_profiles cp
      WHERE cp.id = calibration_entries.coffee_profile_id
      AND user_has_location(cp.location_id)
      AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
    ))
    OR
    (recipe_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.id = calibration_entries.recipe_id
      AND user_has_tenant(r.tenant_id)
      AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
    ))
  )
  OR
  is_tupa_admin()
);