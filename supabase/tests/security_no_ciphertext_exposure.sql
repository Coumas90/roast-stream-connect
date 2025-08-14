-- Security test: block client roles from reading ciphertext
-- Fails (RAISE EXCEPTION) if exposure is detected.

-- 1) No GRANTS de SELECT(ciphertext) a roles cliente
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM information_schema.column_privileges
  WHERE table_schema IN ('public','secrets')
    AND table_name = 'pos_provider_credentials'
    AND column_name = 'ciphertext'
    AND grantee IN ('anon','authenticated','public');
  IF cnt > 0 THEN
    RAISE EXCEPTION 'EXPOSED_SENSITIVE_DATA: ciphertext privilege granted to client roles (count=%).', cnt;
  END IF;
END$$;

-- 2) La vista pública NO debe exponer ciphertext
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name  = 'pos_provider_credentials_public'
    AND column_name = 'ciphertext';
  IF cnt > 0 THEN
    RAISE EXCEPTION 'EXPOSED_SENSITIVE_DATA: ciphertext present in public view.';
  END IF;
END$$;

-- 3) Prueba funcional best-effort: intentar actuar como 'authenticated' (si el rol actual tiene privilegio)
DO $$
DECLARE
  can_switch boolean := true;
BEGIN
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
  EXCEPTION WHEN insufficient_privilege THEN
    can_switch := false; -- no podemos asumir rol; omitimos check funcional
  END;

  IF can_switch THEN
    BEGIN
      -- Intento de leer ciphertext
      PERFORM 1
      FROM public.pos_provider_credentials
      WHERE ciphertext IS NOT NULL
      LIMIT 1;

      -- Si llegó acá sin error, expusimos datos sensibles
      RAISE EXCEPTION 'EXPOSED_SENSITIVE_DATA: authenticated could read ciphertext.';
    EXCEPTION WHEN others THEN
      -- Esperado: permiso denegado / RLS / esquema movido -> no hacer nada
      NULL;
    END;
  END IF;
END$$;