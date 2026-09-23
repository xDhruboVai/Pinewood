-- Pine Wood: core schema
-- All reservation times are stored as timestamptz; the restaurant operates in Asia/Dhaka.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.staff_role as enum ('manager', 'foh');

create type public.reservation_status as enum (
  'pending',    -- awaiting staff phone verification; holds capacity until expires_at
  'confirmed',  -- verified by staff; confirmation email + pre-order link sent
  'seated',
  'completed',
  'cancelled',
  'rejected',
  'expired',    -- staff could not reach the guest within 24h
  'no_show'
);

create type public.waitlist_status as enum ('waiting', 'promoted', 'cancelled', 'expired');

create type public.preorder_status as enum ('submitted', 'acknowledged', 'preparing', 'ready', 'served', 'cancelled');

create type public.menu_section as enum ('starters', 'mains', 'coffee', 'desserts', 'beverages');

create type public.email_kind as enum ('received', 'waitlist_promoted', 'confirmed', 'cancelled', 'reminder');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.generate_reference()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(6);
  result text := 'PW-';
begin
  for i in 0..5 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------
create table public.staff_profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  role       public.staff_role not null default 'foh',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Seating: areas are capacity pools; tables are assigned flexibly by staff
-- ---------------------------------------------------------------------------
create table public.areas (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name_en        text not null,
  name_bn        text not null,
  description_en text,
  description_bn text,
  is_active      boolean not null default true,
  sort_order     int not null default 0
);

create table public.dining_tables (
  id        uuid primary key default gen_random_uuid(),
  area_id   uuid not null references public.areas (id) on delete cascade,
  label     text not null,
  seats     int not null check (seats between 1 and 20),
  is_active boolean not null default true,
  unique (area_id, label)
);

-- ---------------------------------------------------------------------------
-- Hours (weekday: 0 = Sunday, matching extract(dow))
-- ---------------------------------------------------------------------------
create table public.opening_hours (
  weekday   smallint primary key check (weekday between 0 and 6),
  opens_at  time,
  closes_at time,
  is_closed boolean not null default false,
  check (is_closed or (opens_at is not null and closes_at is not null))
);

-- Holiday / Ramadan overrides. The most recently created matching override wins.
create table public.hours_overrides (
  id         uuid primary key default gen_random_uuid(),
  label      text not null check (char_length(label) between 2 and 80),
  starts_on  date not null,
  ends_on    date not null,
  opens_at   time,
  closes_at  time,
  is_closed  boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (is_closed or (opens_at is not null and closes_at is not null))
);

-- ---------------------------------------------------------------------------
-- Reservations
-- ---------------------------------------------------------------------------
create table public.reservations (
  id                     uuid primary key default gen_random_uuid(),
  reference              text not null unique default public.generate_reference(),
  area_id                uuid not null references public.areas (id),
  starts_at              timestamptz not null,
  ends_at                timestamptz not null,
  party_size             smallint not null check (party_size between 1 and 10),
  large_party            boolean not null default false,
  customer_name          text not null check (char_length(customer_name) between 2 and 80),
  phone                  text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email                  text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  special_requests       text check (char_length(special_requests) <= 500),
  locale                 text not null default 'en' check (locale in ('en', 'bn')),
  status                 public.reservation_status not null default 'pending',
  expires_at             timestamptz,
  source                 text not null default 'web' check (source in ('web', 'waitlist', 'staff')),
  consent_at             timestamptz not null default now(),
  confirmed_at           timestamptz,
  confirmed_by           uuid references auth.users (id) on delete set null,
  cancelled_at           timestamptz,
  cancel_reason          text check (char_length(cancel_reason) <= 300),
  cancel_requested_at    timestamptz,
  seated_at              timestamptz,
  completed_at           timestamptz,
  staff_notes            text check (char_length(staff_notes) <= 1000),
  token_version          int not null default 1,
  confirmation_email_at  timestamptz,
  reminder_email_at      timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index reservations_area_time_idx on public.reservations (area_id, starts_at, ends_at);
create index reservations_status_idx on public.reservations (status, starts_at);
create index reservations_phone_idx on public.reservations (phone);
create index reservations_email_idx on public.reservations (lower(email));

create trigger reservations_touch before update on public.reservations
  for each row execute function public.touch_updated_at();

create table public.reservation_tables (
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  table_id       uuid not null references public.dining_tables (id) on delete cascade,
  primary key (reservation_id, table_id)
);

-- Short-lived holds while a guest fills in their details (slot-hold TTL).
create table public.slot_holds (
  id          uuid primary key default gen_random_uuid(),
  area_id     uuid not null references public.areas (id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  party_size  smallint not null check (party_size between 1 and 10),
  client_key  text not null,
  ip_hash     text not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index slot_holds_area_time_idx on public.slot_holds (area_id, starts_at, ends_at);
create index slot_holds_client_idx on public.slot_holds (client_key);
create index slot_holds_ip_idx on public.slot_holds (ip_hash);

-- Staff blockouts (walk-ins, private events). area_id null = whole restaurant.
create table public.blockouts (
  id         uuid primary key default gen_random_uuid(),
  area_id    uuid references public.areas (id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  seats      int check (seats > 0),
  reason     text not null default 'Walk-ins' check (char_length(reason) <= 120),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (area_id is not null or seats is null)
);

create index blockouts_time_idx on public.blockouts (starts_at, ends_at);

create table public.waitlist_entries (
  id                     uuid primary key default gen_random_uuid(),
  area_id                uuid not null references public.areas (id) on delete cascade,
  starts_at              timestamptz not null,
  ends_at                timestamptz not null,
  party_size             smallint not null check (party_size between 1 and 10),
  large_party            boolean not null default false,
  customer_name          text not null check (char_length(customer_name) between 2 and 80),
  phone                  text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email                  text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  locale                 text not null default 'en' check (locale in ('en', 'bn')),
  status                 public.waitlist_status not null default 'waiting',
  promoted_reservation_id uuid references public.reservations (id) on delete set null,
  promoted_at            timestamptz,
  consent_at             timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index waitlist_area_time_idx on public.waitlist_entries (area_id, starts_at) where status = 'waiting';

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------
create table public.menu_categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  section    public.menu_section not null,
  name_en    text not null,
  name_bn    text not null,
  sort_order int not null default 0
);

create table public.menu_items (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid not null references public.menu_categories (id) on delete cascade,
  slug           text not null unique,
  name_en        text not null,
  name_bn        text not null,
  description_en text,
  description_bn text,
  price          numeric(10, 2) not null check (price >= 0),
  image_url      text,
  tags           text[] not null default '{}'
                 check (tags <@ array['halal', 'vegetarian', 'chef_special', 'spicy', 'seafood', 'contains_nuts']::text[]),
  is_available   boolean not null default true,
  is_featured    boolean not null default false,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index menu_items_category_idx on public.menu_items (category_id, sort_order);

create trigger menu_items_touch before update on public.menu_items
  for each row execute function public.touch_updated_at();

-- One option group per item (e.g. Single / Double shot, Chicken / Prawn).
create table public.menu_item_variants (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.menu_items (id) on delete cascade,
  name_en     text not null,
  name_bn     text not null,
  price_delta numeric(10, 2) not null default 0,
  is_default  boolean not null default false,
  sort_order  int not null default 0
);

create unique index menu_item_variants_one_default on public.menu_item_variants (item_id) where is_default;

create table public.menu_item_addons (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.menu_items (id) on delete cascade,
  name_en      text not null,
  name_bn      text not null,
  price        numeric(10, 2) not null default 0 check (price >= 0),
  is_available boolean not null default true,
  sort_order   int not null default 0
);

-- ---------------------------------------------------------------------------
-- Pre-orders (payment at the restaurant; kitchen prep only)
-- ---------------------------------------------------------------------------
create table public.pre_orders (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations (id) on delete cascade,
  status         public.preorder_status not null default 'submitted',
  notes          text check (char_length(notes) <= 500),
  total          numeric(10, 2) not null default 0,
  submitted_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger pre_orders_touch before update on public.pre_orders
  for each row execute function public.touch_updated_at();

create table public.pre_order_items (
  id            uuid primary key default gen_random_uuid(),
  pre_order_id  uuid not null references public.pre_orders (id) on delete cascade,
  menu_item_id  uuid references public.menu_items (id) on delete set null,
  variant_id    uuid references public.menu_item_variants (id) on delete set null,
  addon_ids     uuid[] not null default '{}',
  -- Snapshots so kitchen tickets and analytics survive later menu edits.
  item_name     text not null,
  variant_name  text,
  addon_names   text[] not null default '{}',
  unit_price    numeric(10, 2) not null,
  quantity      smallint not null check (quantity between 1 and 20),
  notes         text check (char_length(notes) <= 200),
  line_total    numeric(10, 2) not null
);

create index pre_order_items_order_idx on public.pre_order_items (pre_order_id);

-- ---------------------------------------------------------------------------
-- Content
-- ---------------------------------------------------------------------------
create table public.reviews (
  id             uuid primary key default gen_random_uuid(),
  author_name    text not null,
  author_context text,
  rating         smallint not null check (rating between 1 and 5),
  body_en        text not null,
  body_bn        text,
  is_published   boolean not null default true,
  sort_order     int not null default 0
);

-- ---------------------------------------------------------------------------
-- Email audit
-- ---------------------------------------------------------------------------
create table public.email_log (
  id             bigint generated always as identity primary key,
  reservation_id uuid references public.reservations (id) on delete cascade,
  kind           public.email_kind not null,
  status         text not null check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider_id    text,
  error          text,
  created_at     timestamptz not null default now()
);

create index email_log_reservation_idx on public.email_log (reservation_id, created_at desc);
