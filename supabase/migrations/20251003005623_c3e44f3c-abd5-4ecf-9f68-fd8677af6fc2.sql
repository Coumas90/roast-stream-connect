-- FASE 4: MIGRACIÓN A COFFEE_PROFILES POR LOCATION
-- 4.1 Crear tabla recipe_locations para relacionar recetas con sucursales

CREATE TABLE IF NOT EXISTS public.recipe_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(recipe_id, location_id)
);

-- RLS policies para recipe_locations
ALTER TABLE public.recipe_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipe_locations_select_by_location"
ON public.recipe_locations FOR SELECT
USING (user_has_location(location_id) OR is_tupa_admin());

CREATE POLICY "recipe_locations_insert_manager"
ON public.recipe_locations FOR INSERT
WITH CHECK ((user_has_location(location_id) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))) OR is_tupa_admin());

CREATE POLICY "recipe_locations_update_manager"
ON public.recipe_locations FOR UPDATE
USING ((user_has_location(location_id) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))) OR is_tupa_admin());

CREATE POLICY "recipe_locations_delete_admin"
ON public.recipe_locations FOR DELETE
USING (is_tupa_admin());

-- 4.2 Añadir recipe_id a coffee_profiles para vincular con receta global
ALTER TABLE public.coffee_profiles
ADD COLUMN IF NOT EXISTS recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL;

-- 4.3 Añadir hopper_id a calibration_entries para vincular con café específico
ALTER TABLE public.calibration_entries
ADD COLUMN IF NOT EXISTS hopper_id uuid REFERENCES public.location_stock(id) ON DELETE SET NULL;

-- 4.4 Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_recipe_locations_location ON public.recipe_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_recipe_locations_recipe ON public.recipe_locations(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_locations_active ON public.recipe_locations(location_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_coffee_profiles_recipe ON public.coffee_profiles(recipe_id);
CREATE INDEX IF NOT EXISTS idx_coffee_profiles_location_active ON public.coffee_profiles(location_id, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_calibration_entries_hopper ON public.calibration_entries(hopper_id);

-- 4.5 Añadir trigger para updated_at en recipe_locations
CREATE TRIGGER update_recipe_locations_updated_at
BEFORE UPDATE ON public.recipe_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4.6 Comentarios para documentación
COMMENT ON TABLE public.recipe_locations IS 'Relaciona recetas globales con sucursales específicas';
COMMENT ON COLUMN public.coffee_profiles.recipe_id IS 'Receta global en la que se basa este perfil de café';
COMMENT ON COLUMN public.calibration_entries.hopper_id IS 'Hopper específico del cual se sirvió el café en esta calibración';