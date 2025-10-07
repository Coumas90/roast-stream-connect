-- Migración de datos: crear coffee_profiles desde recipes activas
-- Este script replica la lógica de migrate-recipes-to-profiles.ts

DO $$
DECLARE
  loc RECORD;
  active_recipe RECORD;
  target_dose NUMERIC;
  target_temp NUMERIC;
  existing_profile UUID;
BEGIN
  -- Iterar sobre todas las locations
  FOR loc IN 
    SELECT id, name, tenant_id 
    FROM public.locations
  LOOP
    -- Buscar receta activa del tenant
    SELECT * INTO active_recipe
    FROM public.recipes
    WHERE tenant_id = loc.tenant_id
      AND is_active = true
    LIMIT 1;

    -- Si no hay receta activa, saltar esta location
    IF active_recipe IS NULL THEN
      RAISE NOTICE 'Location %: No active recipe found', loc.name;
      CONTINUE;
    END IF;

    -- Verificar si ya existe un perfil activo para esta location
    SELECT id INTO existing_profile
    FROM public.coffee_profiles
    WHERE location_id = loc.id
      AND active = true
    LIMIT 1;

    IF existing_profile IS NOT NULL THEN
      RAISE NOTICE 'Location %: Profile already exists, skipping', loc.name;
      CONTINUE;
    END IF;

    -- Sanitizar parámetros (valores seguros entre rangos)
    target_dose := GREATEST(1, LEAST(30, COALESCE(active_recipe.coffee_amount::numeric, 18)));
    target_temp := GREATEST(80, LEAST(100, COALESCE(active_recipe.temperature::numeric, 93)));

    -- Crear coffee_profile
    INSERT INTO public.coffee_profiles (
      name,
      location_id,
      tenant_id,
      recipe_id,
      target_dose_g,
      target_ratio_min,
      target_ratio_max,
      target_time_min,
      target_time_max,
      target_temp_c,
      brew_method,
      active
    ) VALUES (
      active_recipe.name || ' - ' || loc.name,
      loc.id,
      loc.tenant_id,
      active_recipe.id,
      target_dose,
      1.8,
      2.2,
      25,
      32,
      target_temp,
      'espresso',
      true
    );

    RAISE NOTICE 'Location %: Profile created successfully', loc.name;
  END LOOP;

  RAISE NOTICE 'Migration complete!';
END $$;