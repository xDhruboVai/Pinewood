-- Pinewood: branches (Phase 3, BIZ-01)
--
-- Pinewood has three outlets, but every area, table and opening hour belonged to one shared pool and
-- the guest's branch only travelled in the booking notes. This migration gives areas, opening hours,
-- holiday overrides and blockouts a branch, and makes availability and slot checks branch-aware.
--
-- Safe to run on the live database:
--   * nothing is dropped except function signatures that are recreated below, and no rows are deleted;
--   * existing areas are NOT assigned to a branch (they were invented for the first build), so a branch
--     has no bookable seats until its real areas and tables are added (supabase/setup/branch_setup.sql);
--   * existing reservations keep their area; their branch is simply unknown;
--   * a call without a branch (p_branch null) only sees areas that have no branch, i.e. exactly the old
--     pool, so the previous frontend keeps working until the new one is deployed.
-- Deploy order: this migration, then the branch data, then the website.

-- ---------------------------------------------------------------------------
-- Branches
-- ---------------------------------------------------------------------------
create table if not exists public.branches (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_en    text not null check (char_length(name_en) between 2 and 80),
  name_bn    text not null check (char_length(name_bn) between 1 and 80),
  is_active  boolean not null default true,
  sort_order int not null default 0
);

-- The three outlets as the website names them (src/lib/site.ts OUTLETS; the slugs must match).
-- Addresses, hours and seating stay out of this migration: they aren't confirmed yet.
insert into public.branches (slug, name_en, name_bn, sort_order) values
  ('dhanmondi-6',  'Dhanmondi, Road 6',  'ধানমন্ডি, রোড ৬',  1),
  ('dhanmondi-27', 'Dhanmondi, Road 27', 'ধানমন্ডি, রোড ২৭', 2),
  ('banani',       'Banani',             'বনানী',           3)
on conflict (slug) do nothing;

alter table public.branches enable row level security;
drop policy if exists "public read branches" on public.branches;
create policy "public read branches" on public.branches for select to anon, authenticated using (true);
drop policy if exists "managers write branches" on public.branches;
create policy "managers write branches" on public.branches for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- ---------------------------------------------------------------------------
-- Areas: which branch they're in, and inside (non-smoking) or outside (smoking)
-- ---------------------------------------------------------------------------
alter table public.areas add column if not exists branch_id uuid references public.branches (id) on delete restrict;
alter table public.areas add column if not exists seating text not null default 'inside';
do $$ begin
  alter table public.areas add constraint areas_seating_check check (seating in ('inside', 'outside'));
exception when duplicate_object then null; end $$;
create index if not exists areas_branch_idx on public.areas (branch_id) where is_active;

-- The booking form used to guess "outside" from the area's name; keep the same answer for existing rows.
update public.areas set seating = 'outside'
 where seating = 'inside' and (slug || ' ' || name_en) ~* '(outdoor|outside|rooftop|balcony|terrace|smok)';

-- ---------------------------------------------------------------------------
-- Hours, holiday overrides and blockouts per branch (branch null = every branch)
-- ---------------------------------------------------------------------------
alter table public.opening_hours add column if not exists branch_id uuid references public.branches (id) on delete cascade;
alter table public.opening_hours add column if not exists id uuid not null default gen_random_uuid();
-- The weekday alone was the key; now it's (branch, weekday), with one row per weekday for "every branch".
do $$ begin
  if exists (
    select 1 from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.conrelid = 'public.opening_hours'::regclass and c.contype = 'p' and a.attname = 'weekday'
  ) then
    alter table public.opening_hours drop constraint opening_hours_pkey;
    alter table public.opening_hours add constraint opening_hours_pkey primary key (id);
  end if;
end $$;
create unique index if not exists opening_hours_branch_weekday_key on public.opening_hours (branch_id, weekday) nulls not distinct;

alter table public.hours_overrides add column if not exists branch_id uuid references public.branches (id) on delete cascade;

alter table public.blockouts add column if not exists branch_id uuid references public.branches (id) on delete cascade;
-- An area blockout already implies its branch; branch_id is for "the whole branch" (area_id null).
do $$ begin
  alter table public.blockouts add constraint blockouts_area_or_branch check (area_id is null or branch_id is null);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Service window for a branch: branch override > all-branch override > branch hours > all-branch hours.
-- ---------------------------------------------------------------------------
drop function if exists public.service_window(date);
create or replace function public.service_window(p_date date, p_branch uuid default null)
returns table (opens timestamptz, closes timestamptz, label text)
language sql
stable
set search_path = ''
as $$
  with candidates as (
    select case when o.branch_id is null then 2 else 1 end as priority, o.opens_at, o.closes_at, o.is_closed, o.label, o.created_at
      from public.hours_overrides o
     where p_date between o.starts_on and o.ends_on
       and (o.branch_id is null or o.branch_id = p_branch)
    union all
    select case when h.branch_id is null then 4 else 3 end, h.opens_at, h.closes_at, h.is_closed, null::text, null::timestamptz
      from public.opening_hours h
     where h.weekday = extract(dow from p_date)::int
       and (h.branch_id is null or h.branch_id = p_branch)
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

-- ---------------------------------------------------------------------------
-- Peak load: whole-restaurant blockouts now mean "every branch" (branch_id null) or "this branch".
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
  area_branch as (select branch_id from public.areas where id = p_area),
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
     where (b.area_id = p_area
            or (b.area_id is null and (b.branch_id is null or b.branch_id = (select branch_id from area_branch))))
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

-- ---------------------------------------------------------------------------
-- Slot rules, checked against the branch's own hours.
-- ---------------------------------------------------------------------------
drop function if exists public.assert_bookable_slot(timestamptz, int, int);
create or replace function public.assert_bookable_slot(p_start timestamptz, p_duration_minutes int, p_party_size int, p_branch uuid default null)
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

  select * into w from public.service_window(v_date, p_branch) sw where p_start >= sw.opens and v_end <= sw.closes;
  if not found then
    select * into w from public.service_window(v_date - 1, p_branch) sw where p_start >= sw.opens and v_end <= sw.closes;
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
-- Public availability grid for one branch (no PII). p_branch null = areas with no branch (old pool).
-- ---------------------------------------------------------------------------
drop function if exists public.get_availability(date, int, int);
create or replace function public.get_availability(p_date date, p_party_size int, p_duration_minutes int, p_branch uuid default null)
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
  if p_branch is not null and not exists (select 1 from public.branches b where b.id = p_branch and b.is_active) then
    return;
  end if;

  v_dur := make_interval(mins => p_duration_minutes);
  select * into w from public.service_window(p_date, p_branch);
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
       and ar.branch_id is not distinct from p_branch
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

-- Resolved hours for the next N days, for one branch (null = the hours every branch shares).
drop function if exists public.get_schedule(int);
create or replace function public.get_schedule(p_days int default 14, p_branch uuid default null)
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
              and (o.branch_id is null or o.branch_id = p_branch)
            order by (o.branch_id is null), o.created_at desc limit 1
         ))
    from generate_series((now() at time zone 'Asia/Dhaka')::date,
                         (now() at time zone 'Asia/Dhaka')::date + least(greatest(p_days, 1), 60) - 1,
                         interval '1 day') d
    left join lateral public.service_window(d::date, p_branch) sw on true
   order by 1;
$$;

-- ---------------------------------------------------------------------------
-- Holds and waitlist: the area decides the branch, and the branch decides the hours.
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
  v_branch uuid;
  v_end    timestamptz;
  v_load   record;
  v_id     uuid;
  v_exp    timestamptz;
begin
  select a.branch_id into v_branch
    from public.areas a
    left join public.branches b on b.id = a.branch_id
   where a.id = p_area and a.is_active and (a.branch_id is null or b.is_active);
  if not found then
    raise exception 'PW_INVALID_AREA';
  end if;

  v_end := public.assert_bookable_slot(p_start, p_duration_minutes, p_party_size, v_branch);

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
  v_branch uuid;
  v_end    timestamptz;
  v_load   record;
  v_id     uuid;
begin
  select a.branch_id into v_branch
    from public.areas a
    left join public.branches b on b.id = a.branch_id
   where a.id = p_area and a.is_active and (a.branch_id is null or b.is_active);
  if not found then
    raise exception 'PW_INVALID_AREA';
  end if;

  v_end := public.assert_bookable_slot(p_start, p_duration_minutes, p_party_size, v_branch);

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

-- ---------------------------------------------------------------------------
-- Staff lists: include the branch (from the booking's area).
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
      'party_size', r.party_size, 'starts_at', r.starts_at, 'area', a.name_en, 'branch', br.name_en,
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
  order by r.starts_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants (same model as 20260923000300: lock down, then open what each role needs)
-- ---------------------------------------------------------------------------
revoke execute on function public.service_window(date, uuid) from public, anon, authenticated;
revoke execute on function public.assert_bookable_slot(timestamptz, int, int, uuid) from public, anon, authenticated;
revoke execute on function public.get_availability(date, int, int, uuid) from public;
revoke execute on function public.get_schedule(int, uuid) from public;
grant execute on function public.get_availability(date, int, int, uuid) to anon, authenticated;
grant execute on function public.get_schedule(int, uuid) to anon, authenticated;
grant execute on function public.service_window(date, uuid) to service_role;
grant execute on function public.assert_bookable_slot(timestamptz, int, int, uuid) to service_role;
grant execute on function public.get_availability(date, int, int, uuid) to service_role;
grant execute on function public.get_schedule(int, uuid) to service_role;
