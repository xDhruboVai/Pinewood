-- Branch managers may only see and manage reservations belonging to their assigned branch.
-- Owners and front-of-house retain their existing all-branch access.

create or replace function public.staff_can_access_branch(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.staff_profiles sp
     where sp.user_id = auth.uid()
       and sp.is_active
       and (
         sp.role::text in ('owner', 'foh')
         or (sp.role::text = 'manager' and p_branch_id is not null and sp.branch_id = p_branch_id)
       )
  );
$$;

create or replace function public.staff_can_access_reservation(p_reservation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.reservations r
      join public.areas a on a.id = r.area_id
     where r.id = p_reservation_id
       and public.staff_can_access_branch(a.branch_id)
  );
$$;

revoke all on function public.staff_can_access_branch(uuid) from public, anon;
revoke all on function public.staff_can_access_reservation(uuid) from public, anon;
grant execute on function public.staff_can_access_branch(uuid) to authenticated, service_role;
grant execute on function public.staff_can_access_reservation(uuid) to authenticated, service_role;

drop policy if exists "staff read reservations" on public.reservations;
create policy "staff read reservations" on public.reservations for select to authenticated
  using (public.staff_can_access_reservation(id));

drop policy if exists "staff read reservation tables" on public.reservation_tables;
create policy "staff read reservation tables" on public.reservation_tables for select to authenticated
  using (public.staff_can_access_reservation(reservation_id));

drop policy if exists "staff read waitlist" on public.waitlist_entries;
create policy "staff read waitlist" on public.waitlist_entries for select to authenticated
  using (
    exists (
      select 1 from public.areas a
       where a.id = waitlist_entries.area_id
         and public.staff_can_access_branch(a.branch_id)
    )
  );

drop policy if exists "staff update waitlist" on public.waitlist_entries;
create policy "staff update waitlist" on public.waitlist_entries for update to authenticated
  using (
    exists (
      select 1 from public.areas a
       where a.id = waitlist_entries.area_id
         and public.staff_can_access_branch(a.branch_id)
    )
  )
  with check (
    exists (
      select 1 from public.areas a
       where a.id = waitlist_entries.area_id
         and public.staff_can_access_branch(a.branch_id)
    )
  );

drop policy if exists "staff read pre-orders" on public.pre_orders;
create policy "staff read pre-orders" on public.pre_orders for select to authenticated
  using (public.staff_can_access_reservation(reservation_id));

drop policy if exists "staff read pre-order items" on public.pre_order_items;
create policy "staff read pre-order items" on public.pre_order_items for select to authenticated
  using (
    exists (
      select 1
        from public.pre_orders po
       where po.id = pre_order_items.pre_order_id
         and public.staff_can_access_reservation(po.reservation_id)
    )
  );

drop policy if exists "staff read email log" on public.email_log;
create policy "staff read email log" on public.email_log for select to authenticated
  using (public.staff_can_access_reservation(reservation_id));

create or replace function public.admin_list_reservations(p_from date, p_to date)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'PW_FORBIDDEN';
  end if;

  return query
  select jsonb_build_object(
    'id', r.id,
    'reference', r.reference,
    'status', r.status,
    'source', r.source,
    'starts_at', r.starts_at,
    'ends_at', r.ends_at,
    'party_size', r.party_size,
    'large_party', r.large_party,
    'customer_name', r.customer_name,
    'phone', r.phone,
    'email', r.email,
    'special_requests', r.special_requests,
    'locale', r.locale,
    'expires_at', r.expires_at,
    'confirmed_at', r.confirmed_at,
    'cancel_requested_at', r.cancel_requested_at,
    'cancel_reason', r.cancel_reason,
    'staff_notes', r.staff_notes,
    'created_at', r.created_at,
    'area', jsonb_build_object('id', a.id, 'slug', a.slug, 'name', a.name_en, 'seating', a.seating),
    'branch', case when br.id is null then null else jsonb_build_object('id', br.id, 'slug', br.slug, 'name', br.name_en) end,
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'label', t.label, 'seats', t.seats) order by t.label)
        from public.reservation_tables rt
        join public.dining_tables t on t.id = rt.table_id
       where rt.reservation_id = r.id
    ), '[]'::jsonb),
    'history', (
      select jsonb_build_object(
        'bookings', count(*),
        'visits', count(*) filter (where h.status in ('seated', 'completed')),
        'no_shows', count(*) filter (where h.status = 'no_show'),
        'cancellations', count(*) filter (where h.status = 'cancelled')
      )
        from public.reservations h
       where h.id <> r.id
         and public.staff_can_access_reservation(h.id)
         and (h.phone = r.phone or lower(h.email) = lower(r.email))
    ),
    'pre_order', (
      select jsonb_build_object(
        'id', po.id, 'status', po.status, 'total', po.total,
        'item_count', (select coalesce(sum(quantity), 0) from public.pre_order_items i where i.pre_order_id = po.id)
      )
        from public.pre_orders po
       where po.reservation_id = r.id
    ),
    'last_email', (
      select jsonb_build_object('kind', l.kind, 'status', l.status, 'at', l.created_at, 'error', l.error)
        from public.email_log l
       where l.reservation_id = r.id
       order by l.created_at desc, l.id desc
       limit 1
    )
  )
  from public.reservations r
  join public.areas a on a.id = r.area_id
  left join public.branches br on br.id = a.branch_id
  where r.starts_at >= (p_from::timestamp at time zone 'Asia/Dhaka')
    and r.starts_at < ((p_to + 1)::timestamp at time zone 'Asia/Dhaka')
    and public.staff_can_access_reservation(r.id)
  order by r.starts_at, r.created_at;
end;
$$;

create or replace function public.admin_list_pre_orders(p_from date, p_to date)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'PW_FORBIDDEN';
  end if;

  return query
  select jsonb_build_object(
    'id', po.id,
    'status', po.status,
    'notes', po.notes,
    'total', po.total,
    'submitted_at', po.submitted_at,
    'reservation', jsonb_build_object(
      'id', r.id, 'reference', r.reference, 'status', r.status,
      'customer_name', r.customer_name, 'phone', r.phone,
      'party_size', r.party_size, 'starts_at', r.starts_at, 'area', a.name_en,
      'branch', br.name_en,
      'tables', coalesce((
        select jsonb_agg(t.label order by t.label)
          from public.reservation_tables rt join public.dining_tables t on t.id = rt.table_id
         where rt.reservation_id = r.id
      ), '[]'::jsonb)
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'name', i.item_name, 'variant', i.variant_name, 'addons', i.addon_names,
        'quantity', i.quantity, 'notes', i.notes, 'line_total', i.line_total
      ) order by i.item_name)
        from public.pre_order_items i where i.pre_order_id = po.id
    ), '[]'::jsonb)
  )
  from public.pre_orders po
  join public.reservations r on r.id = po.reservation_id
  join public.areas a on a.id = r.area_id
  left join public.branches br on br.id = a.branch_id
  where r.starts_at >= (p_from::timestamp at time zone 'Asia/Dhaka')
    and r.starts_at < ((p_to + 1)::timestamp at time zone 'Asia/Dhaka')
    and public.staff_can_access_reservation(r.id)
  order by r.starts_at;
end;
$$;

create or replace function public.admin_set_status(p_id uuid, p_status public.reservation_status, p_reason text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'PW_FORBIDDEN';
  end if;

  update public.reservations
     set status = p_status,
         cancel_reason = case when p_status in ('cancelled', 'rejected') then left(nullif(trim(p_reason), ''), 300) else cancel_reason end
   where id = p_id and public.staff_can_access_reservation(id);

  if not found then
    raise exception 'PW_NOT_FOUND';
  end if;
end;
$$;

create or replace function public.admin_dismiss_cancel_request(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'PW_FORBIDDEN';
  end if;
  update public.reservations set cancel_requested_at = null
   where id = p_id and public.staff_can_access_reservation(id);
  if not found then
    raise exception 'PW_NOT_FOUND';
  end if;
end;
$$;

create or replace function public.admin_update_notes(p_id uuid, p_notes text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'PW_FORBIDDEN';
  end if;
  update public.reservations set staff_notes = left(nullif(trim(p_notes), ''), 1000)
   where id = p_id and public.staff_can_access_reservation(id);
  if not found then
    raise exception 'PW_NOT_FOUND';
  end if;
end;
$$;

create or replace function public.admin_assign_tables(p_id uuid, p_table_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_branch_id uuid;
begin
  if not public.is_staff() then
    raise exception 'PW_FORBIDDEN';
  end if;
  if not public.staff_can_access_reservation(p_id) then
    raise exception 'PW_NOT_FOUND';
  end if;

  select a.branch_id into v_branch_id
    from public.reservations r join public.areas a on a.id = r.area_id
   where r.id = p_id;
  delete from public.reservation_tables where reservation_id = p_id;
  insert into public.reservation_tables (reservation_id, table_id)
  select p_id, t.id
    from public.dining_tables t
    join public.areas a on a.id = t.area_id
   where t.id = any (coalesce(p_table_ids, '{}'))
     and t.is_active
     and a.branch_id is not distinct from v_branch_id;
end;
$$;

create or replace function public.admin_resend_email(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status public.reservation_status;
begin
  if not public.is_staff() then
    raise exception 'PW_FORBIDDEN';
  end if;

  select status into v_status from public.reservations
   where id = p_id and public.staff_can_access_reservation(id);
  if not found then
    raise exception 'PW_NOT_FOUND';
  end if;
  if v_status = 'confirmed' then
    perform public.enqueue_email(p_id, 'confirmed');
  elsif v_status = 'pending' then
    perform public.enqueue_email(p_id, 'received');
  else
    raise exception 'PW_INVALID_TRANSITION';
  end if;
end;
$$;

create or replace function public.admin_delete_reservation(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status public.reservation_status;
begin
  if not public.is_manager() then
    raise exception 'PW_FORBIDDEN';
  end if;
  select status into v_status from public.reservations
   where id = p_id and public.staff_can_access_reservation(id) for update;
  if not found then
    raise exception 'PW_NOT_FOUND';
  end if;
  if v_status in ('pending', 'confirmed', 'seated') then
    raise exception 'PW_NOT_DELETABLE';
  end if;
  delete from public.reservations where id = p_id;
end;
$$;

create or replace function public.admin_set_pre_order_status(p_id uuid, p_status public.preorder_status)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_current public.preorder_status;
begin
  if not public.is_staff() then
    raise exception 'PW_FORBIDDEN';
  end if;
  select po.status into v_current
    from public.pre_orders po
    join public.reservations r on r.id = po.reservation_id
   where po.id = p_id and public.staff_can_access_reservation(r.id)
   for update of po;
  if not found then
    raise exception 'PW_NOT_FOUND';
  end if;
  if v_current = p_status then
    return;
  end if;
  if v_current in ('served', 'cancelled') or p_status = 'submitted' then
    raise exception 'PW_INVALID_TRANSITION';
  end if;
  update public.pre_orders set status = p_status where id = p_id;
end;
$$;

revoke all on function public.admin_list_reservations(date, date) from public, anon;
revoke all on function public.admin_list_pre_orders(date, date) from public, anon;
revoke all on function public.admin_set_status(uuid, public.reservation_status, text) from public, anon;
revoke all on function public.admin_dismiss_cancel_request(uuid) from public, anon;
revoke all on function public.admin_update_notes(uuid, text) from public, anon;
revoke all on function public.admin_assign_tables(uuid, uuid[]) from public, anon;
revoke all on function public.admin_resend_email(uuid) from public, anon;
revoke all on function public.admin_delete_reservation(uuid) from public, anon;
revoke all on function public.admin_set_pre_order_status(uuid, public.preorder_status) from public, anon;
grant execute on function public.admin_list_reservations(date, date) to authenticated, service_role;
grant execute on function public.admin_list_pre_orders(date, date) to authenticated, service_role;
grant execute on function public.admin_set_status(uuid, public.reservation_status, text) to authenticated, service_role;
grant execute on function public.admin_dismiss_cancel_request(uuid) to authenticated, service_role;
grant execute on function public.admin_update_notes(uuid, text) to authenticated, service_role;
grant execute on function public.admin_assign_tables(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.admin_resend_email(uuid) to authenticated, service_role;
grant execute on function public.admin_delete_reservation(uuid) to authenticated, service_role;
grant execute on function public.admin_set_pre_order_status(uuid, public.preorder_status) to authenticated, service_role;