-- Pinewood: final hardening (Part 7: SEC-05, DATA-03). Narrows three permissions and closes two small
-- integrity gaps. Nothing is removed that the website uses: the public site reads availability through
-- get_availability/get_schedule (SECURITY DEFINER), never dining_tables directly, and staff only ever
-- change a waitlist entry's status.

-- ---------------------------------------------------------------------------
-- SEC-05: dining tables were readable by anyone with the publishable key (labels and seats of every
-- table). Only staff need them.
-- ---------------------------------------------------------------------------
drop policy if exists "public read tables" on public.dining_tables;
drop policy if exists "staff read tables" on public.dining_tables;
create policy "staff read tables" on public.dining_tables for select to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------------
-- SEC-05: staff could update every column of a waitlist entry (name, phone, email...). The admin only
-- changes its status, so that is the only column staff may write. The server's functions run as the
-- table owner and are not affected.
-- ---------------------------------------------------------------------------
revoke update on public.waitlist_entries from anon, authenticated;
grant update (status) on public.waitlist_entries to authenticated;

-- ---------------------------------------------------------------------------
-- SEC-05: a manager could change any staff_profiles column, including their own role or access (the
-- website refuses self-changes; the database did not). Managers may now change other people's name,
-- role and active flag only. The first manager is still created from the SQL editor (vault_secrets.sql).
-- ---------------------------------------------------------------------------
drop policy if exists "managers update staff" on public.staff_profiles;
create policy "managers update staff" on public.staff_profiles for update to authenticated
  using (public.is_manager() and user_id <> (select auth.uid()))
  with check (public.is_manager() and user_id <> (select auth.uid()));
revoke update on public.staff_profiles from anon, authenticated;
grant update (full_name, role, is_active) on public.staff_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- DATA-03: booking references are 6 random characters (about 1 billion combinations). A repeat was
-- very unlikely but would have failed that guest's booking with a generic error; now a used
-- reference is skipped. Runs inside create_reservation / join_waitlist (as the table owner).
-- ---------------------------------------------------------------------------
create or replace function public.generate_reference()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  result text;
begin
  loop
    bytes := extensions.gen_random_bytes(6);
    result := 'PW-';
    for i in 0..5 loop
      result := result || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.reservations r where r.reference = result);
  end loop;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- DATA-03: pre-order status rules. A served or cancelled pre-order is final, and "submitted" is only
-- ever set by the guest's own save (upsert_pre_order). Unknown ids now say so instead of doing nothing.
-- ---------------------------------------------------------------------------
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
  select status into v_current from public.pre_orders where id = p_id for update;
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
