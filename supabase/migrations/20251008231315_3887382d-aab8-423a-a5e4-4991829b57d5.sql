-- FASE 1: Limpieza de recetas huérfanas y duplicadas
-- Pre-auditoría: Log del estado actual
INSERT INTO pos_logs (level, scope, message, meta)
VALUES (
  'info',
  'recipe_cleanup',
  'FASE 1: Iniciando limpieza de recetas',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'pre_cleanup_audit',
    'target_delete', '27958613-ff96-4fe3-8d4b-18100bb2a96f',
    'target_archive', '5de9eadf-76e0-477c-9f93-b49c449a43cf'
  )
);

-- PASO 1.1: Eliminar steps de "Palmeras" primero (cascada manual)
DELETE FROM recipe_steps 
WHERE recipe_id = '27958613-ff96-4fe3-8d4b-18100bb2a96f';

-- PASO 1.2: Eliminar receta "Palmeras" SOLO si NO tiene dependencias
DELETE FROM recipes 
WHERE id = '27958613-ff96-4fe3-8d4b-18100bb2a96f' 
  AND tenant_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM calibration_entries WHERE recipe_id = '27958613-ff96-4fe3-8d4b-18100bb2a96f'
  )
  AND NOT EXISTS (
    SELECT 1 FROM coffee_profiles WHERE recipe_id = '27958613-ff96-4fe3-8d4b-18100bb2a96f'
  );

-- PASO 1.3: Archivar receta "saas" duplicada (la con menos calibraciones)
UPDATE recipes 
SET status = 'archived'
WHERE id = '5de9eadf-76e0-477c-9f93-b49c449a43cf'
  AND name = 'saas';

-- Post-auditoría: Log del resultado
INSERT INTO pos_logs (level, scope, message, meta)
SELECT 
  'info',
  'recipe_cleanup',
  'FASE 1: Limpieza completada',
  jsonb_build_object(
    'timestamp', now(),
    'total_recipes', COUNT(*),
    'active_recipes', COUNT(*) FILTER (WHERE status = 'published'),
    'archived_recipes', COUNT(*) FILTER (WHERE status = 'archived'),
    'deleted_palmeras', CASE WHEN NOT EXISTS(SELECT 1 FROM recipes WHERE id = '27958613-ff96-4fe3-8d4b-18100bb2a96f') THEN true ELSE false END
  )
FROM recipes;