-- Pinewood: let a manager delete a booking that is over (declined, cancelled, not confirmed, no-show
-- or completed), e.g. a test or duplicate request. A live booking (pending or confirmed) is declined
-- or cancelled first, so the guest is emailed and the seats are freed the usual way.
-- Its tables, pre-order and email log go with it (on delete cascade); a waitlist entry that was
-- promoted to it keeps its row with the link cleared (on delete set null).

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
  select status into v_status from public.reservations where id = p_id for update;
  if not found then
    raise exception 'PW_NOT_FOUND';
  end if;
  if v_status in ('pending', 'confirmed', 'seated') then
    raise exception 'PW_NOT_DELETABLE';
  end if;
  delete from public.reservations where id = p_id;
end;
$$;

revoke execute on function public.admin_delete_reservation(uuid) from public, anon;
grant execute on function public.admin_delete_reservation(uuid) to authenticated, service_role;
