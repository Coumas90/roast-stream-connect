-- Clean corrupt recipe data before migration to coffee_profiles
-- This migration fixes invalid numeric values in recipes table

-- 1.1 Corregir recetas con datos inválidos
UPDATE recipes 
SET 
  coffee_amount = '18',
  water_amount = '36', 
  temperature = '93',
  updated_at = now()
WHERE 
  coffee_amount !~ '^[0-9.]+$' 
  OR water_amount !~ '^[0-9.]+$' 
  OR temperature !~ '^[0-9.]+$';

-- 1.2 Eliminar receta huérfana (sin tenant_id)
-- Esta receta NO tiene calibraciones asociadas, es seguro eliminarla
DELETE FROM recipes WHERE tenant_id IS NULL;

-- 1.3 Verificación post-limpieza
DO $$
DECLARE
  invalid_count INTEGER;
  orphan_count INTEGER;
BEGIN
  -- Verificar recetas con datos inválidos
  SELECT COUNT(*) INTO invalid_count
  FROM recipes
  WHERE coffee_amount !~ '^[0-9.]+$' 
    OR water_amount !~ '^[0-9.]+$' 
    OR temperature !~ '^[0-9.]+$';
  
  -- Verificar recetas sin tenant_id
  SELECT COUNT(*) INTO orphan_count
  FROM recipes
  WHERE tenant_id IS NULL;
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Still have % recipes with invalid numeric data after cleanup', invalid_count;
  END IF;
  
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Still have % orphan recipes without tenant_id after cleanup', orphan_count;
  END IF;
  
  RAISE NOTICE '✅ Data cleanup successful: all recipes now have valid data';
  RAISE NOTICE '   - Invalid numeric values corrected';
  RAISE NOTICE '   - Orphan recipes removed';
END $$;