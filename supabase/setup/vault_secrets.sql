-- TEMPLATE. Never commit real values to this file.
--
-- Run ONCE in the Supabase SQL editor after the migrations. Paste this into the editor and replace
-- the placeholders there, or copy it to vault_secrets.local.sql (git-ignored) and edit the copy.
-- These let Postgres call the email pipeline (via pg_net) when a reservation is created,
-- confirmed, cancelled or due a reminder. public.enqueue_email() appends /reservation-email to
-- pinewood_functions_url, so use either:
--   the Render service base URL:      https://YOUR-RENDER-SERVICE.onrender.com
--   or the Supabase functions URL:    https://YOUR-PROJECT-REF.supabase.co/functions/v1
--
-- pinewood_webhook_secret must equal WEBHOOK_SECRET in Render and in the Edge Function secrets
-- (supabase secrets set). Generate one with:  openssl rand -hex 32

select vault.create_secret(
  'https://pinewood-byr3.onrender.com',
  'pinewood_functions_url',
  'Base URL that receives the reservation-email webhook'
);

select vault.create_secret(
  'b2587d15b3c826a565ffc7fea8bc07553dd5625928642d1c0863e95fc0d35f1a',
  'pinewood_webhook_secret',
  'Shared secret sent as x-webhook-secret to reservation-email'
);

-- Make yourself the first manager (after creating your user in Authentication -> Users):
-- insert into public.staff_profiles (user_id, full_name, role)
-- select id, 'Your Name', 'manager' from auth.users where email = 'you@example.com';

-- To rotate later (update all three places: Vault, Render WEBHOOK_SECRET, Edge Function WEBHOOK_SECRET):
-- select vault.update_secret((select id from vault.secrets where name = 'pinewood_webhook_secret'), 'NEW-SECRET');
-- select vault.update_secret((select id from vault.secrets where name = 'pinewood_functions_url'), 'NEW-URL');
