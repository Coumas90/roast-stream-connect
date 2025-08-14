-- Fix SECURITY DEFINER functions with missing search_path settings
-- Sets local timeouts for this migration
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';

-- Fix all SECURITY DEFINER functions that don't have SET search_path TO public

-- 1. Fix effective_pos function
CREATE OR REPLACE FUNCTION public.effective_pos(_tenant_id uuid, _location_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(provider app_pos_provider, source text, connected boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Autorización a nivel tenant (admin platform también permitido dentro de user_has_tenant)
  IF NOT public.user_has_tenant(_tenant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Prioridad: location conectado > tenant conectado
  IF _location_id IS NOT NULL THEN
    RETURN QUERY
    SELECT pil.provider, 'location'::text AS source, pil.connected
    FROM public.pos_integrations_location pil
    WHERE pil.location_id = _location_id AND pil.connected = true
    LIMIT 1;
  END IF;

  -- Si no hay override o no hay location
  RETURN QUERY
  SELECT pit.provider, 'tenant'::text AS source, pit.connected
  FROM public.pos_integrations_tenant pit
  WHERE pit.tenant_id = _tenant_id AND pit.connected = true
  LIMIT 1;
END;
$function$;

-- 2. Fix set_pos_tenant function
CREATE OR REPLACE FUNCTION public.set_pos_tenant(_tenant_id uuid, _provider app_pos_provider, _connected boolean, _config jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
BEGIN
  -- Permisos: admin plataforma o owner del tenant
  IF NOT (public.is_tupa_admin() OR (public.user_has_tenant(_tenant_id) AND public.has_role(auth.uid(), 'owner'))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Lock por tenant para evitar carreras
  PERFORM pg_advisory_xact_lock(hashtextextended(_tenant_id::text, 0));

  IF _connected THEN
    -- Apagar otros proveedores conectados
    UPDATE public.pos_integrations_tenant
    SET connected = false, updated_at = v_now
    WHERE tenant_id = _tenant_id AND connected = true AND provider IS DISTINCT FROM _provider;

    -- Upsert proveedor objetivo
    INSERT INTO public.pos_integrations_tenant(tenant_id, provider, connected, config, created_at, updated_at)
    VALUES (_tenant_id, _provider, true, COALESCE(_config, '{}'::jsonb), v_now, v_now)
    ON CONFLICT (tenant_id, provider)
    DO UPDATE SET connected = EXCLUDED.connected, config = EXCLUDED.config, updated_at = v_now;
  ELSE
    -- Desconectar proveedor objetivo
    INSERT INTO public.pos_integrations_tenant(tenant_id, provider, connected, config, created_at, updated_at)
    VALUES (_tenant_id, _provider, false, COALESCE(_config, '{}'::jsonb), v_now, v_now)
    ON CONFLICT (tenant_id, provider)
    DO UPDATE SET connected = false, config = COALESCE(_config, public.pos_integrations_tenant.config), updated_at = v_now;
  END IF;
END;
$function$;

-- 3. Fix set_pos_location function
CREATE OR REPLACE FUNCTION public.set_pos_location(_location_id uuid, _provider app_pos_provider, _connected boolean, _config jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
BEGIN
  -- Permisos: admin o (owner/manager) con acceso a la sucursal
  IF NOT (
    public.is_tupa_admin()
    OR (public.user_has_location(_location_id) AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager')))
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Lock por location
  PERFORM pg_advisory_xact_lock(hashtextextended(_location_id::text, 0));

  IF _connected THEN
    UPDATE public.pos_integrations_location
    SET connected = false, updated_at = v_now
    WHERE location_id = _location_id AND connected = true AND provider IS DISTINCT FROM _provider;

    INSERT INTO public.pos_integrations_location(location_id, provider, connected, config, created_at, updated_at)
    VALUES (_location_id, _provider, true, COALESCE(_config, '{}'::jsonb), v_now, v_now)
    ON CONFLICT (location_id, provider)
    DO UPDATE SET connected = EXCLUDED.connected, config = EXCLUDED.config, updated_at = v_now;
  ELSE
    INSERT INTO public.pos_integrations_location(location_id, provider, connected, config, created_at, updated_at)
    VALUES (_location_id, _provider, false, COALESCE(_config, '{}'::jsonb), v_now, v_now)
    ON CONFLICT (location_id, provider)
    DO UPDATE SET connected = false, config = COALESCE(_config, public.pos_integrations_location.config), updated_at = v_now;
  END IF;
END;
$function$;

-- 4. Fix connect_pos_location function
CREATE OR REPLACE FUNCTION public.connect_pos_location(_location_id uuid, _provider app_pos_provider, _api_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tenant uuid;
  v_allowed boolean;
  v_secret_ref text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select l.tenant_id into v_tenant from public.locations l where l.id = _location_id;
  if v_tenant is null then
    raise exception 'invalid location';
  end if;

  -- Authorization: platform admin OR (has access to location AND role owner/manager)
  v_allowed := public.is_tupa_admin() or (
    public.user_has_location(_location_id) and (
      public.has_role(auth.uid(), 'owner'::public.app_role) or public.has_role(auth.uid(), 'manager'::public.app_role)
    )
  );
  if not v_allowed then
    raise exception 'forbidden';
  end if;

  -- TEMP validation stub: require non-empty api key; real validation delegated to Edge Function
  if _api_key is null or length(trim(_api_key)) = 0 then
    raise exception 'API key inválida o vacía';
  end if;

  -- Build a secret reference (actual secret to be stored in secure vault/kv by backend)
  v_secret_ref := 'pos/location/' || _location_id::text || '/' || _provider::text;

  -- Upsert credentials (location scope)
  insert into public.pos_credentials(id, tenant_id, location_id, provider, secret_ref)
  values (gen_random_uuid(), v_tenant, _location_id, _provider, v_secret_ref)
  on conflict (location_id, provider)
  where _location_id is not null
  do update set secret_ref = excluded.secret_ref, updated_at = now();

  -- Connect effective provider at location
  perform public.set_pos_location(_location_id, _provider, true, '{}'::jsonb);
end;
$function$;

-- 5. Fix user_can_manage_pos function
CREATE OR REPLACE FUNCTION public.user_can_manage_pos(_location_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    public.is_tupa_admin()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.location_id = _location_id
        and ur.role in ('manager')
    )
    or exists (
      select 1
      from public.user_roles ur
      join public.locations l on l.tenant_id = ur.tenant_id
      where ur.user_id = auth.uid()
        and ur.role = 'owner'
        and l.id = _location_id
    );
$function$;

-- 6. Fix log_pos_credential_access function
CREATE OR REPLACE FUNCTION public.log_pos_credential_access(_table_name text, _operation text, _location_id uuid DEFAULT NULL::uuid, _provider text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.pos_logs (
    level,
    scope,
    message,
    location_id,
    provider,
    meta
  ) VALUES (
    'info',
    'security_audit',
    format('POS credential %s operation on table %s', _operation, _table_name),
    _location_id,
    _provider::app_pos_provider,
    jsonb_build_object(
      'user_id', auth.uid(),
      'timestamp', now(),
      'table', _table_name,
      'operation', _operation
    )
  );
END;
$function$;

-- 7. Fix pos_security_audit_summary function
CREATE OR REPLACE FUNCTION public.pos_security_audit_summary()
 RETURNS TABLE(location_id uuid, provider app_pos_provider, access_count bigint, last_access timestamp with time zone, unique_users bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    pl.location_id,
    pl.provider,
    COUNT(*) as access_count,
    MAX(pl.ts) as last_access,
    COUNT(DISTINCT (pl.meta->>'user_id')) as unique_users
  FROM public.pos_logs pl
  WHERE pl.scope = 'security_audit'
    AND pl.location_id IS NOT NULL
    AND (is_tupa_admin() OR user_has_location(pl.location_id))
  GROUP BY pl.location_id, pl.provider
  ORDER BY last_access DESC;
$function$;

-- 8. Fix audit_pos_credentials_access function
CREATE OR REPLACE FUNCTION public.audit_pos_credentials_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Log credential operations to pos_logs for security audit
  INSERT INTO public.pos_logs (
    level,
    scope,
    message,
    location_id,
    provider,
    meta
  ) VALUES (
    'info',
    'security_audit',
    format('POS credential %s operation on table %s', TG_OP, TG_TABLE_NAME),
    COALESCE(NEW.location_id, OLD.location_id),
    COALESCE(NEW.provider, OLD.provider),
    jsonb_build_object(
      'user_id', auth.uid(),
      'timestamp', now(),
      'table', TG_TABLE_NAME,
      'operation', TG_OP
    )
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

-- 9. Fix get_pos_credentials_safe function
CREATE OR REPLACE FUNCTION public.get_pos_credentials_safe(_location_id uuid)
 RETURNS TABLE(location_id uuid, provider app_pos_provider, masked_hints jsonb, status text, last_verified_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    c.location_id,
    c.provider,
    c.masked_hints,
    c.status,
    c.last_verified_at,
    c.updated_at
  FROM public.pos_provider_credentials c
  WHERE c.location_id = _location_id
    AND public.user_can_manage_pos(_location_id);
$function$;

-- 10. Fix upsert_consumption function
CREATE OR REPLACE FUNCTION public.upsert_consumption(_client_id uuid, _location_id uuid, _provider text, _date date, _total numeric, _orders integer, _items integer, _discounts numeric, _taxes numeric, _meta jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  if not (public.is_tupa_admin()
          or public.user_has_tenant(_client_id)
          or public.user_has_location(_location_id)) then
    raise exception 'forbidden';
  end if;

  insert into public.consumptions as c
    (client_id, location_id, provider, date, total, orders, items, discounts, taxes, meta)
  values
    (_client_id, _location_id, _provider, _date,
     coalesce(_total,0), coalesce(_orders,0), coalesce(_items,0),
     coalesce(_discounts,0), coalesce(_taxes,0), coalesce(_meta,'{}'::jsonb))
  on conflict (client_id, location_id, provider, date)
  do update set
    total = excluded.total,
    orders = excluded.orders,
    items = excluded.items,
    discounts = excluded.discounts,
    taxes = excluded.taxes,
    meta = excluded.meta,
    updated_at = now()
  returning id into v_id;

  return v_id;
end; 
$function$;

-- 11. Fix create_location_invitation function
CREATE OR REPLACE FUNCTION public.create_location_invitation(_email text, _role app_role, _location_id uuid, _expires_in_minutes integer DEFAULT 10080)
 RETURNS TABLE(id uuid, token text, email text, role app_role, tenant_id uuid, location_id uuid, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
  v_inviter uuid;
  v_is_owner boolean;
  v_is_manager boolean;
  v_allowed boolean;
  v_token text;
  v_hash text;
  v_expires_at timestamptz;
  v_id uuid;
BEGIN
  v_inviter := auth.uid();
  IF v_inviter IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT l.tenant_id INTO v_tenant
  FROM public.locations l
  WHERE l.id = _location_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'invalid location';
  END IF;

  IF NOT public.user_has_location(_location_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_inviter
      AND ur.role = 'owner'::public.app_role
      AND (ur.location_id = _location_id OR ur.tenant_id = v_tenant)
  ) INTO v_is_owner;

  SELECT EXISTS(
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_inviter
      AND ur.role = 'manager'::public.app_role
      AND (ur.location_id = _location_id OR ur.tenant_id = v_tenant)
  ) INTO v_is_manager;

  IF NOT (v_is_owner OR v_is_manager) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;

  v_allowed := CASE
    WHEN v_is_owner THEN _role IN ('manager'::public.app_role, 'coffee_master'::public.app_role, 'barista'::public.app_role)
    WHEN v_is_manager THEN _role IN ('coffee_master'::public.app_role, 'barista'::public.app_role)
    ELSE FALSE
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'role not allowed';
  END IF;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + make_interval(mins => _expires_in_minutes);

  DELETE FROM public.invitations i
  WHERE i.tenant_id = v_tenant
    AND i.location_id = _location_id
    AND lower(i.email) = lower(_email)
    AND i.accepted_at IS NULL;

  INSERT INTO public.invitations AS inv (id, token_hash, tenant_id, location_id, email, role, expires_at, created_by)
  VALUES (extensions.gen_random_uuid(), v_hash, v_tenant, _location_id, lower(_email), _role, v_expires_at, v_inviter)
  RETURNING inv.id INTO v_id;

  -- Evento permitido por el constraint
  PERFORM public.log_invitation_event('sent', v_id, lower(_email), v_tenant, jsonb_build_object('role', _role, 'location_id', _location_id));

  RETURN QUERY
  SELECT v_id, v_token, lower(_email), _role, v_tenant, _location_id, v_expires_at;
END;
$function$;

-- 12. Fix user_has_location function
CREATE OR REPLACE FUNCTION public.user_has_location(_location_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    public.is_tupa_admin()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.location_id = _location_id
    )
    or exists (
      select 1
      from public.user_roles ur
      join public.locations l on l.id = _location_id
      where ur.user_id = auth.uid()
        and ur.tenant_id = l.tenant_id
        and ur.role in ('owner'::public.app_role, 'manager'::public.app_role)
    )
$function$;

-- 13. Fix list_location_members function
CREATE OR REPLACE FUNCTION public.list_location_members(_location_id uuid)
 RETURNS TABLE(user_id uuid, role app_role, tenant_id uuid, location_id uuid, created_at timestamp with time zone, full_name text, email text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    ur.user_id,
    ur.role,
    ur.tenant_id,
    ur.location_id,
    ur.created_at,
    p.full_name,
    au.email
  from public.user_roles ur
  left join public.profiles p on p.id = ur.user_id
  left join auth.users au on au.id = ur.user_id
  where ur.location_id = _location_id
    and (
      public.is_tupa_admin()
      or public.user_has_location(_location_id)
    )
  order by ur.created_at asc
$function$;

-- 14. Fix is_tupa_admin function
CREATE OR REPLACE FUNCTION public.is_tupa_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.has_role(auth.uid(), 'tupa_admin');
$function$;

-- 15. Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), null)
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- 16. Fix has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = _role
  );
$function$;

-- 17. Fix user_has_tenant function
CREATE OR REPLACE FUNCTION public.user_has_tenant(_tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and (ur.tenant_id = _tenant_id)
  ) or public.is_tupa_admin();
$function$;

-- 18. Fix assign_role_by_email function
CREATE OR REPLACE FUNCTION public.assign_role_by_email(_email text, _role app_role, _tenant_slug text DEFAULT NULL::text, _location_code text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid;
  v_tenant uuid;
  v_location uuid;
begin
  -- Allow only platform admins to assign roles
  if not public.is_tupa_admin() then
    raise exception 'only tupa_admin can assign roles';
  end if;

  select u.id into v_user
  from auth.users u
  where u.email = _email
  limit 1;

  if v_user is null then
    raise exception 'user with email % not found', _email;
  end if;

  if _tenant_slug is not null then
    select t.id into v_tenant
    from public.tenants t
    where t.slug = _tenant_slug
    limit 1;

    if v_tenant is null then
      raise exception 'tenant with slug % not found', _tenant_slug;
    end if;
  end if;

  if _location_code is not null then
    select l.id into v_location
    from public.locations l
    where l.code = _location_code
      and (v_tenant is null or l.tenant_id = v_tenant)
    limit 1;

    if v_location is null then
      raise exception 'location with code % not found (and/or not under tenant %)', _location_code, _tenant_slug;
    end if;
  end if;

  -- insert only if not already present (no unique constraint required)
  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_user
      and ur.role = _role
      and ur.tenant_id is not distinct from v_tenant
      and ur.location_id is not distinct from v_location
  ) then
    insert into public.user_roles(user_id, role, tenant_id, location_id)
    values (v_user, _role, v_tenant, v_location);
  end if;
end;
$function$;

-- 19. Fix revoke_role_by_email function
CREATE OR REPLACE FUNCTION public.revoke_role_by_email(_email text, _role app_role, _tenant_slug text DEFAULT NULL::text, _location_code text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid;
  v_tenant uuid;
  v_location uuid;
begin
  if not public.is_tupa_admin() then
    raise exception 'only tupa_admin can revoke roles';
  end if;

  select u.id into v_user
  from auth.users u
  where u.email = _email
  limit 1;

  if v_user is null then
    raise exception 'user with email % not found', _email;
  end if;

  if _tenant_slug is not null then
    select t.id into v_tenant
    from public.tenants t
    where t.slug = _tenant_slug
    limit 1;
  end if;

  if _location_code is not null then
    select l.id into v_location
    from public.locations l
    where l.code = _location_code
      and (v_tenant is null or l.tenant_id = v_tenant)
    limit 1;
  end if;

  delete from public.user_roles ur
  where ur.user_id = v_user
    and ur.role = _role
    and ur.tenant_id is not distinct from v_tenant
    and ur.location_id is not distinct from v_location;
end;
$function$;

-- 20. Fix log_invitation_event function
CREATE OR REPLACE FUNCTION public.log_invitation_event(_event text, _invitation_id uuid, _email text, _tenant_id uuid, _metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.invitation_audit(event, invitation_id, email, tenant_id, metadata)
  values (_event, _invitation_id, lower(_email), _tenant_id, _metadata);
$function$;

-- 21. Fix list_location_invitations function
CREATE OR REPLACE FUNCTION public.list_location_invitations(_location_id uuid)
 RETURNS TABLE(id uuid, email text, role app_role, tenant_id uuid, location_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, expires_at timestamp with time zone, accepted_at timestamp with time zone, created_by uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.user_has_location(_location_id) then
    raise exception 'forbidden';
  end if;

  return query
  select i.id, i.email, i.role, i.tenant_id, i.location_id, i.created_at, i.updated_at, i.expires_at, i.accepted_at, i.created_by
  from public.invitations i
  where i.location_id = _location_id
    and i.accepted_at is null
    and i.expires_at > now()
  order by i.created_at desc;
end;
$function$;

-- 22. Fix accept_invitation function
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_inv public.invitations%rowtype;
  v_user_id uuid;
  v_email text;
  v_hash text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  v_user_id := auth.uid();
  v_email := (auth.jwt() ->> 'email');
  if v_email is null then
    raise exception 'email not found in token';
  end if;

  v_hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  select * into v_inv
  from public.invitations i
  where i.token_hash = v_hash
    and (i.expires_at is null or i.expires_at > now())
    and i.accepted_at is null
  limit 1;

  if not found then
    raise exception 'invalid or expired invitation';
  end if;

  if lower(v_inv.email) <> lower(v_email) then
    raise exception 'invitation email mismatch';
  end if;

  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_user_id
      and ur.role = v_inv.role
      and ur.tenant_id = v_inv.tenant_id
      and ur.location_id is not distinct from v_inv.location_id
  ) then
    insert into public.user_roles(user_id, role, tenant_id, location_id)
    values (v_user_id, v_inv.role, v_inv.tenant_id, v_inv.location_id);
  end if;

  update public.invitations
  set accepted_at = now(),
      accepted_by = v_user_id
  where id = v_inv.id;

  perform public.log_invitation_event('accepted', v_inv.id, v_email, v_inv.tenant_id, jsonb_build_object('role', v_inv.role, 'location_id', v_inv.location_id));
end;
$function$;

-- 23. Fix rotate_invitation_token function
CREATE OR REPLACE FUNCTION public.rotate_invitation_token(_invitation_id uuid, _expires_in_minutes integer DEFAULT 10080)
 RETURNS TABLE(id uuid, token text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv public.invitations%rowtype;
  v_inviter uuid;
  v_token text;
  v_hash text;
  v_expires_at timestamptz;
BEGIN
  v_inviter := auth.uid();
  IF v_inviter IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT * INTO v_inv FROM public.invitations WHERE id = _invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found';
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'already accepted';
  END IF;

  IF NOT public.user_has_location(v_inv.location_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_inviter
      AND ur.role IN ('owner'::public.app_role, 'manager'::public.app_role)
      AND (ur.location_id = v_inv.location_id OR ur.tenant_id = v_inv.tenant_id)
  ) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + make_interval(mins => _expires_in_minutes);

  UPDATE public.invitations AS inv
  SET token_hash = v_hash,
      expires_at = v_expires_at,
      updated_at = now()
  WHERE inv.id = _invitation_id;

  -- Evento permitido por el constraint
  PERFORM public.log_invitation_event('sent', _invitation_id, v_inv.email, v_inv.tenant_id, jsonb_build_object('role', v_inv.role, 'location_id', v_inv.location_id));

  RETURN QUERY SELECT _invitation_id, v_token, v_expires_at;
END;
$function$;

-- 24. Fix pos_provider_credentials_public function
CREATE OR REPLACE FUNCTION public.pos_provider_credentials_public(_location_id uuid)
 RETURNS TABLE(location_id uuid, provider app_pos_provider, masked_hints jsonb, status text, last_verified_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Log access attempt
  INSERT INTO public.pos_logs (level, scope, message, location_id, meta)
  VALUES (
    'info',
    'security_audit', 
    'POS credentials accessed via secure function',
    _location_id,
    jsonb_build_object('user_id', auth.uid(), 'timestamp', now())
  );

  -- Return only safe data
  SELECT
    c.location_id,
    c.provider,
    c.masked_hints,
    c.status,
    c.last_verified_at,
    c.updated_at
  FROM public.pos_provider_credentials c
  WHERE c.location_id = _location_id
    AND public.user_can_manage_pos(_location_id);
$function$;

-- 25. Fix revoke_invitation function
CREATE OR REPLACE FUNCTION public.revoke_invitation(_invitation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv public.invitations%rowtype;
  v_inviter uuid;
  v_scramble text;
BEGIN
  v_inviter := auth.uid();
  IF v_inviter IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT * INTO v_inv FROM public.invitations WHERE id = _invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found';
  END IF;

  IF NOT public.user_has_location(v_inv.location_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_inviter
      AND ur.role IN ('owner'::public.app_role, 'manager'::public.app_role)
      AND (ur.location_id = v_inv.location_id OR ur.tenant_id = v_inv.tenant_id)
  ) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;

  v_scramble := encode(extensions.gen_random_bytes(16), 'hex');

  UPDATE public.invitations AS inv
  SET token_hash = encode(extensions.digest(v_scramble, 'sha256'), 'hex'),
      updated_at = now(),
      expires_at = now() - interval '1 minute'
  WHERE inv.id = _invitation_id;

  PERFORM public.log_invitation_event('revoked', _invitation_id, v_inv.email, v_inv.tenant_id, jsonb_build_object('role', v_inv.role, 'location_id', v_inv.location_id));
END;
$function$;

-- 26. Ensure update_credential_rotation_timestamp function is properly configured (idempotent pattern)
CREATE OR REPLACE FUNCTION public.update_credential_rotation_timestamp()
RETURNS TRIGGER AS $f$
BEGIN
  IF OLD.secret_ref IS DISTINCT FROM NEW.secret_ref THEN
    NEW.last_rotation_at = now();
    NEW.status = COALESCE(NEW.status, 'active');
  END IF;
  RETURN NEW;
END;$f$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public';

-- Recreate trigger idempotently
DROP TRIGGER IF EXISTS trigger_pos_credentials_rotation ON public.pos_credentials;
CREATE TRIGGER trigger_pos_credentials_rotation
  BEFORE UPDATE ON public.pos_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_credential_rotation_timestamp();

-- Grant EXECUTE permissions to authenticated users for relevant functions
GRANT EXECUTE ON FUNCTION public.pos_credentials_expiring_soon(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_credential_for_rotation(UUID, app_pos_provider) TO authenticated;

-- Summary of functions patched
SELECT 'SECURITY DEFINER functions patched with search_path TO public:' AS summary;
SELECT 'Fixed 26 functions: effective_pos, set_pos_tenant, set_pos_location, connect_pos_location, user_can_manage_pos, log_pos_credential_access, pos_security_audit_summary, audit_pos_credentials_access, get_pos_credentials_safe, upsert_consumption, create_location_invitation, user_has_location, list_location_members, is_tupa_admin, handle_new_user, has_role, user_has_tenant, assign_role_by_email, revoke_role_by_email, log_invitation_event, list_location_invitations, accept_invitation, rotate_invitation_token, pos_provider_credentials_public, revoke_invitation, update_credential_rotation_timestamp' AS functions_fixed;