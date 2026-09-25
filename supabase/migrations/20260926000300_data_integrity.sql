-- Pinewood: small integrity fixes (Phase 3, DATA-03)
--
-- waitlist_entries.email had no length limit (reservations.email is capped at 254). Added NOT VALID so
-- existing rows can't block the migration, then validated if every existing row already fits.
--
-- Deliberately NOT added: a "price > 0" check on menu_items. No dish is priced at 0 today and the admin
-- screen and server now reject 0 (DATA-01), but a database check would also block unrelated updates
-- (e.g. taking a dish off the menu) on any row that already has a 0 price. The existing
-- "price >= 0" check stays.

do $$ begin
  alter table public.waitlist_entries add constraint waitlist_entries_email_length check (char_length(email) <= 254) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.waitlist_entries validate constraint waitlist_entries_email_length;
exception when check_violation then
  raise notice 'waitlist_entries has emails over 254 characters; the check applies to new rows only';
end $$;
