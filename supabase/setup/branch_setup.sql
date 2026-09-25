-- TEMPLATE: each branch's real seating, tables and (if different) opening hours.
--
-- Run after migration 20260926000100_branches.sql, in the Supabase SQL editor, once the owners have
-- confirmed the details. Until a branch has at least one active area with active tables, the booking
-- form shows "no online slots" for it and guests are asked to call. Nothing here is real data yet:
-- every statement is commented out and every value is a <REPLACE ...> marker. Do not guess.
--
-- Branch slugs: dhanmondi-6, dhanmondi-27, banani  (select slug, name_en from public.branches;)
-- seating: 'inside' (non-smoking) or 'outside' (smoking zone)
-- Table seats: 1-20 per table. An area's online capacity is the sum of its active tables' seats.

-- 1. Areas (one row per room or zone) --------------------------------------------------------------
-- insert into public.areas (slug, name_en, name_bn, description_en, description_bn, seating, branch_id, sort_order)
-- select '<REPLACE area-slug e.g. road6-ground-floor>', '<REPLACE English name>', '<REPLACE Bangla name>',
--        null, null, '<REPLACE inside|outside>', b.id, 1
--   from public.branches b where b.slug = '<REPLACE branch slug>';

-- 2. Tables in that area ----------------------------------------------------------------------------
-- insert into public.dining_tables (area_id, label, seats)
-- select a.id, t.label, t.seats
--   from public.areas a
--   cross join (values ('<REPLACE label>', <REPLACE seats>)) as t(label, seats)
--  where a.slug = '<REPLACE area-slug>';

-- 3. Opening hours, only for a branch whose hours differ from the shared ones -----------------------
--    (rows with branch_id null are the hours every branch uses; 0 = Sunday ... 6 = Saturday)
-- insert into public.opening_hours (branch_id, weekday, opens_at, closes_at, is_closed)
-- select b.id, <REPLACE weekday>, '<REPLACE HH:MM>', '<REPLACE HH:MM>', false
--   from public.branches b where b.slug = '<REPLACE branch slug>';

-- 4. A holiday or closure for one branch (branch_id null = every branch) --------------------------
-- insert into public.hours_overrides (branch_id, label, starts_on, ends_on, is_closed)
-- select b.id, '<REPLACE label>', '<REPLACE YYYY-MM-DD>', '<REPLACE YYYY-MM-DD>', true
--   from public.branches b where b.slug = '<REPLACE branch slug>';

-- 5. REQUIRED once real areas exist: switch off the invented areas from the first build (they have
--    no branch). Existing bookings keep them; nothing is deleted.
-- update public.areas set is_active = false where branch_id is null;

-- Check what each branch can take online:
-- select b.slug, a.slug as area, a.seating, a.is_active, public.area_capacity(a.id) as seats
--   from public.branches b left join public.areas a on a.branch_id = b.id order by 1, 2;
