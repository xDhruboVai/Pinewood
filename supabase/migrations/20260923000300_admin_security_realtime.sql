-- Pine Wood: admin RPCs, RLS, grants, realtime and scheduled jobs

-- ---------------------------------------------------------------------------
-- Admin RPCs (SECURITY DEFINER + explicit role checks; RLS denies direct writes)
-- ---------------------------------------------------------------------------
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
    'area', jsonb_build_object('id', a.id, 'slug', a.slug, 'name', a.name_en),
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
       order by l.created_at desc
       limit 1
    )
  )
  from public.reservations r
  join public.areas a on a.id = r.area_id
  where r.starts_at >= (p_from::timestamp at time zone 'Asia/Dhaka')
    and r.starts_at < ((p_to + 1)::timestamp at time zone 'Asia/Dhaka')
  order by r.starts_at, r.created_at;
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
   where id = p_id;

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
  update public.reservations set cancel_requested_at = null where id = p_id;
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
  update public.reservations set staff_notes = left(nullif(trim(p_notes), ''), 1000) where id = p_id;
end;
$$;

create or replace function public.admin_assign_tables(p_id uuid, p_table_ids uuid[])
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

  delete from public.reservation_tables where reservation_id = p_id;
  insert into public.reservation_tables (reservation_id, table_id)
  select p_id, t.id
    from public.dining_tables t
   where t.id = any (coalesce(p_table_ids, '{}')) and t.is_active;
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

  select status into v_status from public.reservations where id = p_id;
  if v_status = 'confirmed' then
    perform public.enqueue_email(p_id, 'confirmed');
  elsif v_status = 'pending' then
    perform public.enqueue_email(p_id, 'received');
  else
    raise exception 'PW_INVALID_TRANSITION';
  end if;
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
  where r.starts_at >= (p_from::timestamp at time zone 'Asia/Dhaka')
    and r.starts_at < ((p_to + 1)::timestamp at time zone 'Asia/Dhaka')
  order by r.starts_at;
end;
$$;

create or replace function public.admin_set_pre_order_status(p_id uuid, p_status public.preorder_status)
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
  update public.pre_orders set status = p_status where id = p_id;
end;
$$;

create or replace function public.admin_analytics(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := ((now() at time zone 'Asia/Dhaka')::date - least(greatest(p_days, 1), 365) + 1)::timestamp at time zone 'Asia/Dhaka';
  v_result jsonb;
begin
  if not public.is_manager() then
    raise exception 'PW_FORBIDDEN';
  end if;

  select jsonb_build_object(
    'daily_covers', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'covers', d.covers, 'bookings', d.bookings) order by d.day)
        from (
          select g::date as day,
                 coalesce(sum(r.party_size) filter (where r.id is not null), 0) as covers,
                 count(r.id) as bookings
            from generate_series(v_from at time zone 'Asia/Dhaka', (now() at time zone 'Asia/Dhaka'), interval '1 day') g
            left join public.reservations r
              on (r.starts_at at time zone 'Asia/Dhaka')::date = g::date
             and r.status in ('confirmed', 'seated', 'completed')
           group by g::date
        ) d
    ), '[]'::jsonb),
    'peak_hours', coalesce((
      select jsonb_agg(jsonb_build_object('hour', h.hour, 'covers', h.covers) order by h.hour)
        from (
          select extract(hour from r.starts_at at time zone 'Asia/Dhaka')::int as hour, sum(r.party_size) as covers
            from public.reservations r
           where r.starts_at >= v_from and r.status in ('confirmed', 'seated', 'completed')
           group by 1
        ) h
    ), '[]'::jsonb),
    'top_items', coalesce((
      select jsonb_agg(jsonb_build_object('name', t.item_name, 'quantity', t.qty, 'revenue', t.revenue) order by t.qty desc)
        from (
          select i.item_name, sum(i.quantity) as qty, sum(i.line_total) as revenue
            from public.pre_order_items i
            join public.pre_orders po on po.id = i.pre_order_id
            join public.reservations r on r.id = po.reservation_id
           where r.starts_at >= v_from and po.status <> 'cancelled'
           group by i.item_name
           order by 2 desc
           limit 10
        ) t
    ), '[]'::jsonb),
    'totals', (
      select jsonb_build_object(
        'requests', count(*),
        'confirmed', count(*) filter (where status in ('confirmed', 'seated', 'completed')),
        'no_shows', count(*) filter (where status = 'no_show'),
        'expired', count(*) filter (where status = 'expired'),
        'covers', coalesce(sum(party_size) filter (where status in ('confirmed', 'seated', 'completed')), 0)
      )
        from public.reservations
       where starts_at >= v_from
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime: public "availability changed" pings (no PII) via Broadcast
-- ---------------------------------------------------------------------------
create or replace function public.broadcast_availability_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(jsonb_build_object('at', now()), 'changed', 'availability', false);
  exception when others then
    null; -- never block a booking because realtime is unavailable
  end;
  return null;
end;
$$;

create trigger reservations_broadcast after insert or update of status or delete on public.reservations
  for each statement execute function public.broadcast_availability_change();
create trigger slot_holds_broadcast after insert or delete on public.slot_holds
  for each statement execute function public.broadcast_availability_change();
create trigger blockouts_broadcast after insert or update or delete on public.blockouts
  for each statement execute function public.broadcast_availability_change();
create trigger areas_broadcast after update on public.areas
  for each statement execute function public.broadcast_availability_change();
create trigger tables_broadcast after insert or update or delete on public.dining_tables
  for each statement execute function public.broadcast_availability_change();

-- Staff dashboards use postgres_changes (RLS-filtered).
alter publication supabase_realtime add table public.reservations;
alter publication supabase_realtime add table public.pre_orders;
alter publication supabase_realtime add table public.waitlist_entries;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.staff_profiles     enable row level security;
alter table public.areas              enable row level security;
alter table public.dining_tables      enable row level security;
alter table public.opening_hours      enable row level security;
alter table public.hours_overrides    enable row level security;
alter table public.reservations       enable row level security;
alter table public.reservation_tables enable row level security;
alter table public.slot_holds         enable row level security;
alter table public.blockouts          enable row level security;
alter table public.waitlist_entries   enable row level security;
alter table public.menu_categories    enable row level security;
alter table public.menu_items         enable row level security;
alter table public.menu_item_variants enable row level security;
alter table public.menu_item_addons   enable row level security;
alter table public.pre_orders         enable row level security;
alter table public.pre_order_items    enable row level security;
alter table public.reviews            enable row level security;
alter table public.email_log          enable row level security;

-- Staff profiles
create policy "staff read own or manager reads all" on public.staff_profiles
  for select to authenticated using (user_id = (select auth.uid()) or public.is_manager());
create policy "managers update staff" on public.staff_profiles
  for update to authenticated using (public.is_manager()) with check (public.is_manager());

-- Public reference data
create policy "public read areas" on public.areas for select to anon, authenticated using (true);
create policy "managers write areas" on public.areas for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy "public read tables" on public.dining_tables for select to anon, authenticated using (true);
create policy "managers write tables" on public.dining_tables for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy "public read hours" on public.opening_hours for select to anon, authenticated using (true);
create policy "managers write hours" on public.opening_hours for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy "public read overrides" on public.hours_overrides for select to anon, authenticated using (true);
create policy "managers write overrides" on public.hours_overrides for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy "public read categories" on public.menu_categories for select to anon, authenticated using (true);
create policy "managers write categories" on public.menu_categories for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy "public read items" on public.menu_items for select to anon, authenticated using (true);
create policy "managers write items" on public.menu_items for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy "public read variants" on public.menu_item_variants for select to anon, authenticated using (true);
create policy "managers write variants" on public.menu_item_variants for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy "public read addons" on public.menu_item_addons for select to anon, authenticated using (true);
create policy "managers write addons" on public.menu_item_addons for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy "public read published reviews" on public.reviews for select to anon, authenticated
  using (is_published or public.is_staff());
create policy "managers write reviews" on public.reviews for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- Guest data: staff read only; all writes go through RPCs
create policy "staff read reservations" on public.reservations for select to authenticated using (public.is_staff());
create policy "staff read reservation tables" on public.reservation_tables for select to authenticated using (public.is_staff());
create policy "staff read waitlist" on public.waitlist_entries for select to authenticated using (public.is_staff());
create policy "staff update waitlist" on public.waitlist_entries for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "staff read pre-orders" on public.pre_orders for select to authenticated using (public.is_staff());
create policy "staff read pre-order items" on public.pre_order_items for select to authenticated using (public.is_staff());
create policy "staff read email log" on public.email_log for select to authenticated using (public.is_staff());

create policy "staff read blockouts" on public.blockouts for select to authenticated using (public.is_staff());
create policy "staff create blockouts" on public.blockouts for insert to authenticated with check (public.is_staff());
create policy "staff delete blockouts" on public.blockouts for delete to authenticated using (public.is_staff());

-- slot_holds: no policies (server-side RPCs only)

-- ---------------------------------------------------------------------------
-- Function grants. Supabase grants EXECUTE to anon/authenticated by default;
-- lock everything down, then open only what each role needs.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_manager() to anon, authenticated;
grant execute on function public.get_availability(date, int, int) to anon, authenticated;
grant execute on function public.get_schedule(int) to anon, authenticated;

grant execute on function public.admin_list_reservations(date, date) to authenticated;
grant execute on function public.admin_set_status(uuid, public.reservation_status, text) to authenticated;
grant execute on function public.admin_dismiss_cancel_request(uuid) to authenticated;
grant execute on function public.admin_update_notes(uuid, text) to authenticated;
grant execute on function public.admin_assign_tables(uuid, uuid[]) to authenticated;
grant execute on function public.admin_resend_email(uuid) to authenticated;
grant execute on function public.admin_list_pre_orders(date, date) to authenticated;
grant execute on function public.admin_set_pre_order_status(uuid, public.preorder_status) to authenticated;
grant execute on function public.admin_analytics(int) to authenticated;

-- hold_slot, release_hold, create_reservation, join_waitlist, request_cancellation,
-- upsert_pre_order stay service_role only (called by Next.js server actions).
grant execute on all functions in schema public to service_role;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Scheduled jobs
-- ---------------------------------------------------------------------------
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

select cron.schedule('pinewood-housekeeping', '*/5 * * * *', $$select public.run_housekeeping();$$);
