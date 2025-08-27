-- =============================================================================
-- FASE 1: VALIDACIÓN PRE-EJECUCIÓN (READ-ONLY) — VERSION CORREGIDA
-- =============================================================================

-- 1) RLS habilitado en public.locations
DO $$
DECLARE rls_enabled boolean;
BEGIN
  SELECT c.relrowsecurity
    INTO rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'locations' AND n.nspname = 'public';

  RAISE NOTICE '🔍 RLS en public.locations: %',
    CASE WHEN rls_enabled THEN 'HABILITADO ✅' ELSE 'DESHABILITADO ❌' END;

  IF NOT rls_enabled THEN
    RAISE EXCEPTION '❌ CRÍTICO: RLS está DESHABILITADO en public.locations. Debe habilitarse antes de continuar.';
  END IF;
END $$;

-- 2) Policies actuales en locations
SELECT 
  schemaname, tablename, policyname, permissive, roles, cmd,
  qual AS using_expression, with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'locations'
ORDER BY policyname;

-- 3) Funciones críticas: grants + si son SECURITY DEFINER
SELECT 
  n.nspname AS schema,
  p.proname AS function_name,
  p.prosecdef AS is_security_definer,
  rp.grantee,
  rp.privilege_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN information_schema.routine_privileges rp
  ON rp.routine_schema = n.nspname AND rp.routine_name = p.proname
WHERE n.nspname = 'public'
  AND p.proname IN ('get_accessible_locations','get_auth_status')
ORDER BY p.proname, rp.grantee;

-- 4) Grants directos en la tabla locations (PUBLIC/anon)
SELECT 
  table_name, grantee, privilege_type, is_grantable
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'locations'
  AND grantee IN ('PUBLIC','anon')
ORDER BY grantee, privilege_type;

-- 5) Índices críticos
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('user_roles','locations')
ORDER BY tablename, indexname;

-- 6) PRUEBA RLS: simular anon y authenticated
-- ⚠️ IMPORTANTE: el editor SQL corre con rol elevado; inyectamos claims para simular contexto.

-- 6.a) Simular anon
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT 'anon' AS as_role, COUNT(*) AS total_locations_visible FROM public.locations;

-- 6.b) Simular authenticated con un user_id real (toma uno de user_roles)
WITH any_user AS (
  SELECT user_id::text AS sub FROM public.user_roles LIMIT 1
)
SELECT set_config(
  'request.jwt.claims',
  (SELECT json_build_object('role','authenticated','sub', sub)::text FROM any_user),
  true
);
SELECT 'authenticated' AS as_role, COUNT(*) AS total_locations_visible FROM public.locations;

-- 7) Verificar existencia y security_type de get_accessible_locations_safe (si ya existe)
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_accessible_locations_safe';

-- 8) Vistas del dashboard: security_invoker + grants (versión simplificada)
SELECT 
  table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('pos_dashboard_expirations','pos_dashboard_breakers')
ORDER BY table_name, grantee;

-- Fin: aviso
DO $$ BEGIN
  RAISE NOTICE '✅ Fase 1 completada: revisa los resultados antes de aplicar Fase 2.';
END $$;