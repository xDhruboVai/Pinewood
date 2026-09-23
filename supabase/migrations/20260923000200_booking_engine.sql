-- Pine Wood: booking engine (availability, holds, reservations, waitlist)

-- ---------------------------------------------------------------------------
-- Role helpers (used by RLS policies and admin RPCs)
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles
    where user_id = auth.uid() and is_active
  );
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles
    where user_id = auth.uid() and is_active and role = 'manager'
  );
$$;

-- ---------------------------------------------------------------------------
-- Service window for a calendar date (Asia/Dhaka). Overrides win over weekly hours.
-- A closing time at or before the opening time means "closes after midnight".
-- ---------------------------------------------------------------------------
create or replace function public.service_window(p_date date)
returns table (opens timestamptz, closes timestamptz, label text)
language sql
stable
set search_path = ''
as $$
  with candidates as (
    select 1 as priority, o.opens_at, o.closes_at, o.is_closed, o.label, o.created_at
      from public.hours_overrides o
     where p_date between o.starts_on and o.ends_on
    union all
    select 2, h.opens_at, h.closes_at, h.is_closed, null::text, null::timestamptz
      from public.opening_hours h
     where h.weekday = extract(dow from p_date)::int
  ),
  chosen as (
    select * from candidates order by priority, created_at desc nulls last limit 1
  )
  select
    (p_date + c.opens_at) at time zone 'Asia/Dhaka',
    ((case when c.closes_at <= c.opens_at then p_date + 1 else p_date end) + c.closes_at) at time zone 'Asia/Dhaka',
    c.label
  from chosen c
  where not c.is_closed;
$$;

create or replace function public.area_capacity(p_area uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(t.seats), 0)::int
    from public.dining_tables t
    join public.areas a on a.id = t.area_id
   where t.area_id = p_area and t.is_active and a.is_active;
$$;

-- ---------------------------------------------------------------------------
-- Peak seat load inside [p_start, p_end) for an area.
-- Load only increases at item start times, so checking p_start plus every start
-- inside the window gives the exact maximum concurrent occupancy.
-- ---------------------------------------------------------------------------
create or replace function public.peak_load(
  p_area uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_exclude_hold uuid default null,
  p_exclude_reservation uuid default null
)
returns table (total int, has_pending boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with cap as (select public.area_capacity(p_area) as c),
  items as (
    select r.starts_at as s, r.ends_at as e, r.party_size::int as seats, (r.status = 'pending') as is_pending
      from public.reservations r
     where r.area_id = p_area
       and r.starts_at < p_end and r.ends_at > p_start
       and r.id is distinct from p_exclude_reservation
       and (r.status in ('confirmed', 'seated') or (r.status = 'pending' and r.expires_at > now()))
    union all
    select h.starts_at, h.ends_at, h.party_size::int, false
      from public.slot_holds h
     where h.area_id = p_area
       and h.starts_at < p_end and h.ends_at > p_start
       and h.expires_at > now()
       and h.id is distinct from p_exclude_hold
    union all
    select b.starts_at, b.ends_at, coalesce(b.seats, (select c from cap)), false
      from public.blockouts b
     where (b.area_id = p_area or b.area_id is null)
       and b.starts_at < p_end and b.ends_at > p_start
  ),
  points as (
    select p_start as t
    union
    select s from items where s > p_start
  ),
  loads as (
    select p.t, sum(i.seats)::int as total
      from points p
      join items i on i.s <= p.t and i.e > p.t
     group by p.t
  )
  select
    coalesce((select max(l.total) from loads l), 0),
    exists (select 1 from items where is_pending);
$$;

-- Raises a PW_* error if the slot cannot be booked online.
create or replace function public.assert_bookable_slot(p_start timestamptz, p_duration_minutes int, p_party_size int)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_end   timestamptz;
  v_date  date := (p_start at time zone 'Asia/Dhaka')::date;
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  w       record;
begin
  if p_party_size is null or p_party_size < 1 or p_party_size > 10 then
    raise exception 'PW_INVALID_PARTY';
  end if;
  if p_duration_minutes is null or p_duration_minutes not in (60, 90, 120, 180, 240) then
    raise exception 'PW_INVALID_DURATION';
  end if;

  v_end := p_start + make_interval(mins => p_duration_minutes);

  if p_start < now() + interval '60 minutes' then
    raise exception 'PW_TOO_SOON';
  end if;
  if v_date > v_today + 30 then
    raise exception 'PW_TOO_FAR';
  end if;

  select * into w from public.service_window(v_date) sw where p_start >= sw.opens and v_end <= sw.closes;
  if not found then
    select * into w from public.service_window(v_date - 1) sw where p_start >= sw.opens and v_end <= sw.closes;
  end if;
  if not found then
    raise exception 'PW_OUTSIDE_HOURS';
  end if;
  if (extract(epoch from (p_start - w.opens))::bigint % 1800) <> 0 then
    raise exception 'PW_INVALID_SLOT';
  end if;

  return v_end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public availability grid (no PII; callable with the publishable key)
-- ---------------------------------------------------------------------------
create or replace function public.get_availability(p_date date, p_party_size int, p_duration_minutes int)
returns table (
  slot_start timestamptz,
  slot_end timestamptz,
  area_id uuid,
  capacity int,
  remaining int,
  available boolean,
  waitlist_eligible boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_dur interval;
  w record;
begin
  if p_party_size is null or p_party_size < 1 or p_party_size > 10 then
    raise exception 'PW_INVALID_PARTY';
  end if;
  if p_duration_minutes not in (60, 90, 120, 180, 240) then
    raise exception 'PW_INVALID_DURATION';
  end if;
  if p_date < (now() at time zone 'Asia/Dhaka')::date or p_date > (now() at time zone 'Asia/Dhaka')::date + 30 then
    return;
  end if;

  v_dur := make_interval(mins => p_duration_minutes);
  select * into w from public.service_window(p_date);
  if not found then
    return;
  end if;

  return query
  with slots as (
    select g as s, g + v_dur as e
      from generate_series(w.opens, w.closes - v_dur, interval '30 minutes') g
     where g >= now() + interval '60 minutes'
  ),
  a as (
    select ar.id, public.area_capacity(ar.id) as cap
      from public.areas ar
     where ar.is_active
  )
  select
    sl.s,
    sl.e,
    a.id,
    a.cap,
    greatest(a.cap - pl.total, 0),
    (a.cap - pl.total) >= p_party_size,
    ((a.cap - pl.total) < p_party_size and pl.has_pending and a.cap >= p_party_size)
  from slots sl
  cross join a
  cross join lateral public.peak_load(a.id, sl.s, sl.e) pl
  order by sl.s, a.id;
end;
$$;

-- Public: resolved hours for the next N days (for the Visit page and booking calendar).
create or replace function public.get_schedule(p_days int default 14)
returns table (day date, opens timestamptz, closes timestamptz, label text)
language sql
stable
security definer
set search_path = ''
as $$
  select d::date, sw.opens, sw.closes,
         coalesce(sw.label, (
           select o.label from public.hours_overrides o
            where d::date between o.starts_on and o.ends_on
            order by o.created_at desc limit 1
         ))
    from generate_series((now() at time zone 'Asia/Dhaka')::date,
                         (now() at time zone 'Asia/Dhaka')::date + least(greatest(p_days, 1), 60) - 1,
                         interval '1 day') d
    left join lateral public.service_window(d::date) sw on true
   order by 1;
$$;

-- ---------------------------------------------------------------------------
-- Slot hold (TTL 10 minutes). Called server-side only.
-- ---------------------------------------------------------------------------
create or replace function public.hold_slot(
  p_area uuid,
  p_start timestamptz,
  p_duration_minutes int,
  p_party_size int,
  p_client_key text,
  p_ip_hash text
)
returns table (hold_id uuid, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_end  timestamptz;
  v_load record;
  v_id   uuid;
  v_exp  timestamptz;
begin
  v_end := public.assert_bookable_slot(p_start, p_duration_minutes, p_party_size);

  if not exists (select 1 from public.areas where id = p_area and is_active) then
    raise exception 'PW_INVALID_AREA';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_area::text, 0));

  -- One hold per browser; a few per network to limit capacity squatting.
  delete from public.slot_holds where client_key = p_client_key;
  if (select count(*) from public.slot_holds h where h.ip_hash = p_ip_hash and h.expires_at > now()) >= 3 then
    raise exception 'PW_RATE_LIMITED';
  end if;

  select * into v_load from public.peak_load(p_area, p_start, v_end);
  if public.area_capacity(p_area) - v_load.total < p_party_size then
    raise exception 'PW_SLOT_FULL';
  end if;

  insert into public.slot_holds (area_id, starts_at, ends_at, party_size, client_key, ip_hash, expires_at)
  values (p_area, p_start, v_end, p_party_size, p_client_key, p_ip_hash, now() + interval '10 minutes')
  returning id, slot_holds.expires_at into v_id, v_exp;

  return query select v_id, v_exp;
end;
$$;

create or replace function public.release_hold(p_hold_id uuid, p_client_key text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.slot_holds where id = p_hold_id and client_key = p_client_key;
$$;

-- ---------------------------------------------------------------------------
-- Convert a hold into a pending reservation. Called server-side only.
-- Pending requests hold capacity for 24h (or until the slot starts).
-- ---------------------------------------------------------------------------
create or replace function public.create_reservation(
  p_hold_id uuid,
  p_client_key text,
  p_name text,
  p_phone text,
  p_email text,
  p_requests text,
  p_large_party boolean,
  p_locale text
)
returns table (reservation_id uuid, reference text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  h      public.slot_holds;
  v_load record;
  v_id   uuid;
  v_ref  text;
begin
  select * into h from public.slot_holds where id = p_hold_id and client_key = p_client_key;
  if not found then
    raise exception 'PW_HOLD_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(h.area_id::text, 0));

  if h.expires_at <= now() then
    -- Hold lapsed: still allow the booking if the seats are genuinely free.
    select * into v_load from public.peak_load(h.area_id, h.starts_at, h.ends_at, h.id);
    if public.area_capacity(h.area_id) - v_load.total < h.party_size or h.starts_at < now() + interval '30 minutes' then
      delete from public.slot_holds where id = h.id;
      raise exception 'PW_HOLD_EXPIRED';
    end if;
  end if;

  if (select count(*) from public.reservations r
       where r.phone = p_phone and r.status in ('pending', 'confirmed') and r.starts_at > now()) >= 3 then
    raise exception 'PW_TOO_MANY_ACTIVE';
  end if;

  insert into public.reservations (
    area_id, starts_at, ends_at, party_size, large_party,
    customer_name, phone, email, special_requests, locale,
    status, expires_at, source
  ) values (
    h.area_id, h.starts_at, h.ends_at, h.party_size, coalesce(p_large_party, false),
    trim(p_name), p_phone, lower(trim(p_email)), nullif(trim(p_requests), ''), coalesce(p_locale, 'en'),
    'pending', least(now() + interval '24 hours', h.starts_at), 'web'
  )
  returning id, reservations.reference into v_id, v_ref;

  delete from public.slot_holds where id = h.id;

  return query select v_id, v_ref;
end;
$$;

-- ---------------------------------------------------------------------------
-- Waitlist: only when the slot is full AND some of that load is still unconfirmed.
-- ---------------------------------------------------------------------------
create or replace function public.join_waitlist(
  p_area uuid,
  p_start timestamptz,
  p_duration_minutes int,
  p_party_size int,
  p_name text,
  p_phone text,
  p_email text,
  p_large_party boolean,
  p_locale text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_end  timestamptz;
  v_load record;
  v_id   uuid;
begin
  v_end := public.assert_bookable_slot(p_start, p_duration_minutes, p_party_size);

  select * into v_load from public.peak_load(p_area, p_start, v_end);
  if public.area_capacity(p_area) - v_load.total >= p_party_size then
    raise exception 'PW_SLOT_AVAILABLE';
  end if;
  if not v_load.has_pending then
    raise exception 'PW_NOT_WAITLISTABLE';
  end if;

  if exists (select 1 from public.waitlist_entries w
              where w.phone = p_phone and w.starts_at = p_start and w.status = 'waiting') then
    raise exception 'PW_ALREADY_WAITLISTED';
  end if;
  if (select count(*) from public.waitlist_entries w where w.phone = p_phone and w.status = 'waiting') >= 3 then
    raise exception 'PW_TOO_MANY_ACTIVE';
  end if;

  insert into public.waitlist_entries (
    area_id, starts_at, ends_at, party_size, large_party, customer_name, phone, email, locale
  ) values (
    p_area, p_start, v_end, p_party_size, coalesce(p_large_party, false),
    trim(p_name), p_phone, lower(trim(p_email)), coalesce(p_locale, 'en')
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.promote_waitlist(p_area uuid, p_from timestamptz, p_to timestamptz)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e       record;
  v_load  record;
  v_rid   uuid;
  v_count int := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_area::text, 0));

  for e in
    select * from public.waitlist_entries w
     where w.area_id = p_area
       and w.status = 'waiting'
       and w.starts_at < p_to and w.ends_at > p_from
       and w.starts_at > now() + interval '30 minutes'
     order by w.created_at
     for update skip locked
  loop
    select * into v_load from public.peak_load(p_area, e.starts_at, e.ends_at);
    if public.area_capacity(p_area) - v_load.total >= e.party_size then
      insert into public.reservations (
        area_id, starts_at, ends_at, party_size, large_party,
        customer_name, phone, email, locale, status, expires_at, source, consent_at
      ) values (
        e.area_id, e.starts_at, e.ends_at, e.party_size, e.large_party,
        e.customer_name, e.phone, e.email, e.locale, 'pending',
        least(now() + interval '24 hours', e.starts_at), 'waitlist', e.consent_at
      )
      returning id into v_rid;

      update public.waitlist_entries
         set status = 'promoted', promoted_reservation_id = v_rid, promoted_at = now()
       where id = e.id;
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Email dispatch: Postgres -> pg_net -> Edge Function (runs after commit)
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_email(p_reservation uuid, p_kind public.email_kind)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'pinewood_functions_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'pinewood_webhook_secret';

  if v_url is null or v_secret is null then
    insert into public.email_log (reservation_id, kind, status, error)
    values (p_reservation, p_kind, 'skipped', 'Vault secrets pinewood_functions_url / pinewood_webhook_secret are not set');
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/reservation-email',
    body := jsonb_build_object('reservation_id', p_reservation, 'kind', p_kind),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    timeout_milliseconds := 10000
  );

  insert into public.email_log (reservation_id, kind, status) values (p_reservation, p_kind, 'queued');
end;
$$;

-- ---------------------------------------------------------------------------
-- Status lifecycle
-- ---------------------------------------------------------------------------
create or replace function public.reservation_before_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_load record;
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'pending'   and new.status in ('confirmed', 'rejected', 'cancelled', 'expired')) or
    (old.status = 'confirmed' and new.status in ('seated', 'cancelled', 'no_show', 'completed')) or
    (old.status = 'seated'    and new.status in ('completed'))
  ) then
    raise exception 'PW_INVALID_TRANSITION';
  end if;

  if new.status = 'confirmed' then
    -- If the 24h hold already lapsed, the seats may have been re-sold; re-check.
    if old.expires_at is not null and old.expires_at <= now() then
      select * into v_load from public.peak_load(new.area_id, new.starts_at, new.ends_at, null, new.id);
      if public.area_capacity(new.area_id) - v_load.total < new.party_size then
        raise exception 'PW_SLOT_FULL';
      end if;
    end if;
    new.confirmed_at := now();
    new.confirmed_by := auth.uid();
    new.expires_at := null;
  elsif new.status in ('cancelled', 'rejected', 'expired') then
    new.cancelled_at := now();
  elsif new.status = 'seated' then
    new.seated_at := now();
  elsif new.status = 'completed' then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

create trigger reservations_before_status
  before update of status on public.reservations
  for each row execute function public.reservation_before_status();

create or replace function public.reservation_after_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then
    return null;
  end if;

  if new.status = 'confirmed' then
    perform public.enqueue_email(new.id, 'confirmed');
  elsif new.status in ('cancelled', 'rejected', 'expired') then
    perform public.enqueue_email(new.id, 'cancelled');
    update public.pre_orders set status = 'cancelled' where reservation_id = new.id and status <> 'served';
  end if;

  if old.status in ('pending', 'confirmed', 'seated')
     and new.status in ('cancelled', 'rejected', 'expired', 'completed', 'no_show') then
    perform public.promote_waitlist(new.area_id, greatest(new.starts_at, now()), new.ends_at);
  end if;

  return null;
end;
$$;

create trigger reservations_after_status
  after update of status on public.reservations
  for each row execute function public.reservation_after_status();

create or replace function public.reservation_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    perform public.enqueue_email(new.id, case when new.source = 'waitlist' then 'waitlist_promoted' else 'received' end::public.email_kind);
  end if;
  return null;
end;
$$;

create trigger reservations_after_insert
  after insert on public.reservations
  for each row execute function public.reservation_after_insert();

-- ---------------------------------------------------------------------------
-- Guest-facing actions (server-side via signed token only)
-- ---------------------------------------------------------------------------
create or replace function public.request_cancellation(p_reservation uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.reservations
     set cancel_requested_at = coalesce(cancel_requested_at, now())
   where id = p_reservation
     and status in ('pending', 'confirmed')
     and starts_at > now();
  if not found then
    raise exception 'PW_CANNOT_CANCEL';
  end if;
end;
$$;

-- Replaces the guest's pre-order. Prices are always recomputed from the menu.
create or replace function public.upsert_pre_order(p_reservation uuid, p_items jsonb, p_notes text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r          public.reservations;
  v_po       uuid;
  v_existing public.pre_orders;
  it         jsonb;
  mi         public.menu_items;
  v_variant  public.menu_item_variants;
  v_addon_ids   uuid[];
  v_addon_names text[];
  v_addon_sum   numeric;
  v_addon_count int;
  v_qty      int;
  v_unit     numeric;
  v_total    numeric := 0;
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
    if not found or not mi.is_available then
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

    v_unit := mi.price + coalesce(v_variant.price_delta, 0) + v_addon_sum;

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

-- ---------------------------------------------------------------------------
-- Housekeeping (pg_cron, every 5 minutes)
-- ---------------------------------------------------------------------------
create or replace function public.run_housekeeping()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r record;
begin
  delete from public.slot_holds where expires_at < now() - interval '5 minutes';

  -- Fires status triggers per row: guest email + waitlist promotion.
  update public.reservations
     set status = 'expired',
         cancel_reason = coalesce(cancel_reason, 'We could not reach you to confirm in time.')
   where status = 'pending' and expires_at <= now();

  update public.waitlist_entries set status = 'expired'
   where status = 'waiting' and starts_at <= now() + interval '30 minutes';

  -- 2-hour reminders. Skip guests confirmed within the last 3h of their slot (they just got an email).
  for r in
    select id from public.reservations
     where status = 'confirmed'
       and reminder_email_at is null
       and starts_at > now()
       and starts_at <= now() + interval '2 hours'
       and (confirmed_at is null or confirmed_at < starts_at - interval '3 hours')
     for update skip locked
  loop
    update public.reservations set reminder_email_at = now() where id = r.id;
    perform public.enqueue_email(r.id, 'reminder');
  end loop;
end;
$$;
