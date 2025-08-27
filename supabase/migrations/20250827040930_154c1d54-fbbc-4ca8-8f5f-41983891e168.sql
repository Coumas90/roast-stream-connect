-- =============================================================================
-- FASE 1: VALIDACIÓN PRE-EJECUCIÓN - DIAGNÓSTICO COMPLETO
-- =============================================================================

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
    
    RAISE NOTICE '✅ Fase 1 completada: Validación pre-ejecución finalizada';
END $$;