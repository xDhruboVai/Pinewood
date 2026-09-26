-- Branch managers may override a dish's price and availability without changing other outlets.
create table public.menu_item_branch_overrides (
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  price numeric(10, 2) check (price is null or (price > 0 and price <= 100000)),
  is_available boolean,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (menu_item_id, branch_id)
);

alter table public.menu_item_branch_overrides enable row level security;
create policy "public read branch menu overrides" on public.menu_item_branch_overrides
  for select to anon, authenticated using (true);
revoke all on public.menu_item_branch_overrides from anon, authenticated;
grant select on public.menu_item_branch_overrides to anon, authenticated;

-- Global menu edits belong to the owner. Managers write only through the branch-scoped RPC below.
drop policy if exists "managers write categories" on public.menu_categories;
drop policy if exists "managers write items" on public.menu_items;
drop policy if exists "managers write variants" on public.menu_item_variants;
drop policy if exists "managers write addons" on public.menu_item_addons;
create policy "owners write categories" on public.menu_categories for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy "owners write items" on public.menu_items for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy "owners write variants" on public.menu_item_variants for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy "owners write addons" on public.menu_item_addons for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create or replace function public.admin_set_branch_menu_item(
  p_branch_id uuid,
  p_item_id uuid,
  p_set_price boolean,
  p_price numeric,
  p_set_availability boolean,
  p_is_available boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_branch_id uuid;
begin
  select role::text, branch_id into v_role, v_branch_id
    from public.staff_profiles
   where user_id = auth.uid() and is_active;
  if v_role <> 'manager' or v_branch_id is distinct from p_branch_id then
    raise exception 'PW_FORBIDDEN';
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id and is_active) then
    raise exception 'PW_NOT_FOUND';
  end if;
  if not exists (select 1 from public.menu_items where id = p_item_id) then
    raise exception 'PW_NOT_FOUND';
  end if;
  if not coalesce(p_set_price, false) and not coalesce(p_set_availability, false) then
    raise exception 'PW_INVALID_ITEMS';
  end if;
  if coalesce(p_set_price, false) and p_price is not null and
     (p_price <= 0 or p_price > 100000 or p_price * 100 <> trunc(p_price * 100)) then
    raise exception 'PW_INVALID_PRICE';
  end if;

  insert into public.menu_item_branch_overrides (menu_item_id, branch_id, price, is_available, updated_by)
  values (
    p_item_id,
    p_branch_id,
    case when p_set_price then p_price else null end,
    case when p_set_availability then p_is_available else null end,
    auth.uid()
  )
  on conflict (menu_item_id, branch_id) do update
    set price = case when p_set_price then excluded.price else menu_item_branch_overrides.price end,
        is_available = case when p_set_availability then excluded.is_available else menu_item_branch_overrides.is_available end,
        updated_by = auth.uid(),
        updated_at = now();

  delete from public.menu_item_branch_overrides
   where menu_item_id = p_item_id and branch_id = p_branch_id
     and price is null and is_available is null;
end;
$$;

revoke all on function public.admin_set_branch_menu_item(uuid, uuid, boolean, numeric, boolean, boolean) from public, anon;
grant execute on function public.admin_set_branch_menu_item(uuid, uuid, boolean, numeric, boolean, boolean) to authenticated;

-- Recalculate preorder availability and price from the reservation's branch, never the client payload.
create or replace function public.upsert_pre_order(p_reservation uuid, p_items jsonb, p_notes text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r             public.reservations;
  v_po          uuid;
  v_existing    public.pre_orders;
  it            jsonb;
  mi            public.menu_items;
  v_variant     public.menu_item_variants;
  v_branch      uuid;
  v_item_price  numeric;
  v_available   boolean;
  v_addon_ids   uuid[];
  v_addon_names text[];
  v_addon_sum   numeric;
  v_addon_count int;
  v_qty         int;
  v_unit        numeric;
  v_total       numeric := 0;
begin
  select * into r from public.reservations where id = p_reservation for update;
  if not found or r.status <> 'confirmed' then
    raise exception 'PW_PREORDER_CLOSED';
  end if;
  if r.starts_at - interval '60 minutes' <= now() then
    raise exception 'PW_PREORDER_CUTOFF';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 40 then
    raise exception 'PW_INVALID_ITEMS';
  end if;

  select a.branch_id into v_branch from public.areas a where a.id = r.area_id;
  select * into v_existing from public.pre_orders where reservation_id = p_reservation;
  if found and v_existing.status not in ('submitted', 'acknowledged', 'cancelled') then
    raise exception 'PW_PREORDER_LOCKED';
  end if;

  if jsonb_array_length(p_items) = 0 then
    delete from public.pre_orders where reservation_id = p_reservation;
    return null;
  end if;

  insert into public.pre_orders (reservation_id, notes, status, submitted_at)
  values (p_reservation, nullif(trim(p_notes), ''), 'submitted', now())
  on conflict (reservation_id) do update
    set notes = excluded.notes, status = 'submitted', submitted_at = now()
  returning id into v_po;

  delete from public.pre_order_items where pre_order_id = v_po;

  for it in select value from jsonb_array_elements(p_items)
  loop
    select * into mi from public.menu_items where id = (it ->> 'item_id')::uuid;
    if not found then
      raise exception 'PW_ITEM_UNAVAILABLE';
    end if;
    select coalesce(o.is_available, mi.is_available), coalesce(o.price, mi.price)
      into v_available, v_item_price
      from (select 1) seed
      left join public.menu_item_branch_overrides o
        on o.menu_item_id = mi.id and o.branch_id = v_branch;
    if not coalesce(v_available, false) then
      raise exception 'PW_ITEM_UNAVAILABLE';
    end if;

    v_variant := null;
    if coalesce(it ->> 'variant_id', '') <> '' then
      select * into v_variant from public.menu_item_variants
       where id = (it ->> 'variant_id')::uuid and item_id = mi.id;
      if not found then
        raise exception 'PW_INVALID_VARIANT';
      end if;
    elsif exists (select 1 from public.menu_item_variants where item_id = mi.id) then
      select * into v_variant from public.menu_item_variants
       where item_id = mi.id order by is_default desc, sort_order limit 1;
    end if;

    select coalesce(array_agg(distinct x.v::uuid), '{}') into v_addon_ids
      from jsonb_array_elements_text(coalesce(it -> 'addon_ids', '[]'::jsonb)) as x(v);

    select coalesce(array_agg(a.name_en order by a.sort_order), '{}'), coalesce(sum(a.price), 0), count(*)
      into v_addon_names, v_addon_sum, v_addon_count
      from public.menu_item_addons a
     where a.item_id = mi.id and a.is_available and a.id = any (v_addon_ids);
    if v_addon_count <> coalesce(array_length(v_addon_ids, 1), 0) then
      raise exception 'PW_INVALID_ADDON';
    end if;

    v_qty := (it ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 20 then
      raise exception 'PW_INVALID_QUANTITY';
    end if;

    v_unit := v_item_price + coalesce(v_variant.price_delta, 0) + v_addon_sum;

    insert into public.pre_order_items (
      pre_order_id, menu_item_id, variant_id, addon_ids, item_name, variant_name,
      addon_names, unit_price, quantity, notes, line_total
    ) values (
      v_po, mi.id, v_variant.id, v_addon_ids, mi.name_en, v_variant.name_en,
      v_addon_names, v_unit, v_qty, left(nullif(trim(it ->> 'notes'), ''), 200), v_unit * v_qty
    );

    v_total := v_total + v_unit * v_qty;
  end loop;

  update public.pre_orders set total = v_total where id = v_po;
  return v_po;
end;
$$;