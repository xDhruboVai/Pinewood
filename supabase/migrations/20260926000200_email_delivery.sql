-- Pinewood: email delivery that survives a sleeping Render service or a timeout (Phase 3, EMAIL-01)
--
-- Before: enqueue_email() posted the webhook once and logged 'queued'; the email function then wrote a
-- separate 'sent'/'failed' row. If the webhook never arrived (Render asleep, Edge Function down, 10 s
-- timeout) nothing noticed, and nothing was ever retried.
--
-- Now each email is ONE email_log row. The webhook carries its id (log_id); the email function reports
-- the outcome on that row and uses it as Resend's Idempotency-Key, so re-sending the same row can never
-- deliver a second copy. Housekeeping re-posts rows that got no answer (up to 3 attempts in 24 h), then
-- marks them 'failed' so staff can see the problem and press Resend (a new row, sent on purpose).
-- A row is only ever 'sent' when Resend accepted the message.
--
-- Deploy order: the updated reservation-email Edge Function first, then this migration. (An old
-- function would ignore log_id, leave rows 'queued', and the retries would email the guest again.)

alter table public.email_log add column if not exists attempts smallint not null default 0;
alter table public.email_log add column if not exists last_attempt_at timestamptz;
alter table public.email_log add column if not exists updated_at timestamptz;
create index if not exists email_log_queued_idx on public.email_log (last_attempt_at) where status = 'queued';

-- Post one email_log row to the email function (again). Only rows still waiting for an answer.
create or replace function public.dispatch_email(p_log_id bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  l        public.email_log;
  v_url    text;
  v_secret text;
begin
  select * into l from public.email_log where id = p_log_id for update;
  if not found or l.status <> 'queued' then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'pinewood_functions_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'pinewood_webhook_secret';
  if v_url is null or v_secret is null then
    update public.email_log
       set status = 'skipped', error = 'Vault secrets pinewood_functions_url / pinewood_webhook_secret are not set', updated_at = now()
     where id = p_log_id;
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/reservation-email',
    body := jsonb_build_object('reservation_id', l.reservation_id, 'kind', l.kind, 'log_id', l.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    timeout_milliseconds := 10000
  );

  update public.email_log
     set attempts = attempts + 1, last_attempt_at = now(), updated_at = now()
   where id = p_log_id;
end;
$$;

create or replace function public.enqueue_email(p_reservation uuid, p_kind public.email_kind)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.email_log (reservation_id, kind, status) values (p_reservation, p_kind, 'queued')
  returning id into v_id;
  perform public.dispatch_email(v_id);
end;
$$;

-- Housekeeping, unchanged apart from the email retry block at the end.
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

  -- Emails the email function never answered: try again after 10 minutes, at most 3 attempts in 24 h.
  for r in
    select id from public.email_log
     where status = 'queued'
       and attempts between 1 and 2
       and last_attempt_at < now() - interval '10 minutes'
       and created_at > now() - interval '24 hours'
     for update skip locked
  loop
    perform public.dispatch_email(r.id);
  end loop;

  -- Give up visibly, so staff see "not delivered" instead of a row that stays 'queued' forever.
  update public.email_log
     set status = 'failed',
         error = coalesce(error, 'No answer from the email service after ' || attempts || ' attempt(s)'),
         updated_at = now()
   where status = 'queued'
     and ((attempts >= 3 and last_attempt_at < now() - interval '10 minutes') or created_at <= now() - interval '24 hours');
end;
$$;

revoke execute on function public.dispatch_email(bigint) from public, anon, authenticated;
grant execute on function public.dispatch_email(bigint) to service_role;
