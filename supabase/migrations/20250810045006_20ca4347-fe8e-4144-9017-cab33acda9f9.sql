-- RPC: upsert_consumption (SECURITY DEFINER) with fixed search_path and grants
create or replace function public.upsert_consumption(
  _client_id uuid,
  _location_id uuid,
  _provider text,
  _date date,
  _total numeric,
  _orders integer,
  _items integer,
  _discounts numeric,
  _taxes numeric,
  _meta jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
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
end; $$;

-- Ownership and permissions
alter function public.upsert_consumption(
  uuid, uuid, text, date, numeric, integer, integer, numeric, numeric, jsonb
) owner to postgres;

revoke all on function public.upsert_consumption(
  uuid, uuid, text, date, numeric, integer, integer, numeric, numeric, jsonb
) from public;

grant execute on function public.upsert_consumption(
  uuid, uuid, text, date, numeric, integer, integer, numeric, numeric, jsonb
) to authenticated;

grant execute on function public.upsert_consumption(
  uuid, uuid, text, date, numeric, integer, integer, numeric, numeric, jsonb
) to service_role;