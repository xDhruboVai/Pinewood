-- Run ONCE in the Supabase SQL editor after the migrations, replacing the placeholders.
-- These let Postgres call the reservation-email Edge Function (via pg_net) when a
-- reservation is created, confirmed, cancelled or due a reminder.
-- Never commit real values.

select vault.create_secret(
  'https://YOUR-PROJECT-REF.supabase.co/functions/v1',
  'pinewood_functions_url',
  'Base URL for Pine Wood Edge Functions'
);

select vault.create_secret(
  'SAME-VALUE-AS-WEBHOOK_SECRET-IN-supabase/.env',
  'pinewood_webhook_secret',
  'Shared secret sent as x-webhook-secret to reservation-email'
);

-- Make yourself the first manager (after creating your user in Authentication -> Users):
-- insert into public.staff_profiles (user_id, full_name, role)
-- select id, 'Your Name', 'manager' from auth.users where email = 'you@example.com';

-- To rotate a secret later:
-- select vault.update_secret((select id from vault.secrets where name = 'pinewood_webhook_secret'), 'new-value');
