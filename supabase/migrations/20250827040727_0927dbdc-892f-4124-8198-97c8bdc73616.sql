-- =============================================================================
-- FASE 1: VALIDACIÓN PRE-EJECUCIÓN - DIAGNÓSTICO COMPLETO
-- =============================================================================
-- Este es un diagnóstico read-only para confirmar el estado actual del sistema
-- No realizamos cambios, solo validaciones críticas antes de proceder

-- 1️⃣ VERIFICAR QUE RLS ESTÁ HABILITADO EN LOCATIONS
DO $$
DECLARE
    rls_enabled boolean;
BEGIN
    SELECT relrowsecurity INTO rls_enabled 
    FROM pg_class 
    WHERE relname = 'locations';
    
    RAISE NOTICE '🔍 RLS Status en locations: %', CASE WHEN rls_enabled THEN 'HABILITADO ✅' ELSE 'DESHABILITADO ❌' END;
    
    IF NOT rls_enabled THEN
        RAISE EXCEPTION '❌ CRÍTICO: RLS está DESHABILITADO en locations. Debe habilitarse antes de continuar.';
    END IF;
END $$;

-- 2️⃣ VERIFICAR POLICIES ACTUALES EN LOCATIONS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as "using_expression",
    with_check as "with_check_expression"
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'locations'
ORDER BY policyname;

-- 3️⃣ VERIFICAR GRANTS PELIGROSOS EN FUNCIONES CRÍTICAS
SELECT 
    routine_name as "function_name",
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.routine_privileges 
WHERE routine_schema = 'public' 
  AND routine_name IN ('get_accessible_locations', 'get_auth_status')
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
ORDER BY routine_name, grantee;

-- 4️⃣ VERIFICAR GRANTS EN TABLA LOCATIONS
SELECT 
    table_name,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges 
WHERE table_schema = 'public' 
  AND table_name = 'locations'
  AND grantee IN ('PUBLIC', 'anon')
ORDER BY grantee, privilege_type;

-- 5️⃣ VERIFICAR ÍNDICES CRÍTICOS PARA PERFORMANCE
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('user_roles', 'locations')
  AND indexname ~ '(user_roles|locations)'
ORDER BY tablename, indexname;

-- 6️⃣ TEST DE VULNERABILIDAD ACTUAL: ¿Puede anon ver locations?
-- (Este SELECT debería fallar o devolver 0 si la seguridad estuviera bien)
SELECT 
    'VULNERABILIDAD CONFIRMADA: anon puede ver locations' as status,
    COUNT(*) as total_locations_visible_to_anon
FROM public.locations;

-- 7️⃣ VERIFICAR SI EXISTE FUNCIÓN get_accessible_locations_safe
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'get_accessible_locations_safe';

RAISE NOTICE '✅ Fase 1 completada: Validación pre-ejecución finalizada. Revisa los resultados antes de proceder a Fase 2.';