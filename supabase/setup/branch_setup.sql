-- SAMPLE TEST SETUP: branch seating, tables and shared hours for local/integration testing.
--
-- This is not confirmed operational seating data. Replace these sample rows with the owners'
-- confirmed rooms, table sizes and hours before using the site for real bookings.
--
-- Branch slugs: dhanmondi-6, dhanmondi-27, banani.
-- seating: 'inside' (non-smoking) or 'outside' (smoking zone)
-- Table seats: 1-20 per table. An area's online capacity is the sum of its active tables' seats.

-- 1. Areas (one row per room or zone) --------------------------------------------------------------
update public.branches
	 set name_en = 'Banani', name_bn = 'বনানী'
 where slug = 'banani';

insert into public.areas (slug, name_en, name_bn, description_en, description_bn, seating, branch_id, sort_order)
select v.slug, v.name_en, v.name_bn, 'Sample seating for testing only.', 'শুধু পরীক্ষার জন্য নমুনা আসন।', 'inside', b.id, 1
	from (values
		('sample-dhanmondi-6-room', 'Sample Main Room · Dhanmondi Road 6', 'নমুনা মূল কক্ষ · ধানমন্ডি রোড ৬', 'dhanmondi-6'),
		('sample-dhanmondi-27-room', 'Sample Main Room · Dhanmondi Road 27', 'নমুনা মূল কক্ষ · ধানমন্ডি রোড ২৭', 'dhanmondi-27'),
		('sample-banani-room', 'Sample Main Room · Banani', 'নমুনা মূল কক্ষ · বনানী', 'banani')
	) as v(slug, name_en, name_bn, branch_slug)
	join public.branches b on b.slug = v.branch_slug
on conflict (slug) do update
	set name_en = excluded.name_en,
			name_bn = excluded.name_bn,
			description_en = excluded.description_en,
			description_bn = excluded.description_bn,
			seating = excluded.seating,
			branch_id = excluded.branch_id,
			is_active = true,
			sort_order = excluded.sort_order;

-- 2. Tables in that area ----------------------------------------------------------------------------
insert into public.dining_tables (area_id, label, seats)
select a.id, t.label, t.seats
	from public.areas a
	join (values
		('sample-dhanmondi-6-room', 'S1', 2), ('sample-dhanmondi-6-room', 'S2', 4),
		('sample-dhanmondi-6-room', 'S3', 4), ('sample-dhanmondi-6-room', 'S4', 6),
		('sample-dhanmondi-27-room', 'S1', 2), ('sample-dhanmondi-27-room', 'S2', 4),
		('sample-dhanmondi-27-room', 'S3', 4), ('sample-dhanmondi-27-room', 'S4', 6),
		('sample-banani-room', 'S1', 2), ('sample-banani-room', 'S2', 4),
		('sample-banani-room', 'S3', 4), ('sample-banani-room', 'S4', 6)
	) as t(area_slug, label, seats) on t.area_slug = a.slug
on conflict (area_id, label) do update set seats = excluded.seats, is_active = true;

-- The original seed areas are fictional and intentionally have no branch. Keep them out of booking
-- capacity once the branch test areas exist; existing reservations still retain their area ids.
update public.areas set is_active = false where branch_id is null;

-- 3. Opening hours, only for a branch whose hours differ from the shared ones -----------------------
--    (rows with branch_id null are the hours every branch uses; 0 = Sunday ... 6 = Saturday)
-- The seeded shared hours (10:00-22:00, Friday 11:00-22:00) are used for all sample branches.

-- 4. A holiday or closure for one branch (branch_id null = every branch) --------------------------
-- No sample closures are added.

-- 5. REQUIRED once real areas exist: switch off the invented areas from the first build (they have
--    no branch). Existing bookings keep them; nothing is deleted.
-- (Applied above because this file is the sample setup.)

-- Check what each branch can take online:
-- select b.slug, a.slug as area, a.seating, a.is_active, public.area_capacity(a.id) as seats
--   from public.branches b left join public.areas a on a.branch_id = b.id order by 1, 2;
