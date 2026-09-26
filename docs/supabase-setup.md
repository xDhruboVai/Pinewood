# Supabase Setup

This guide provisions the Supabase project used by Pine Wood. Run commands from the repository root after completing [Requirements Installation](requirements-installation.md).

## Create and link a project

1. Create a project at [supabase.com](https://supabase.com), preferably in the Singapore region for Dhaka.
2. Authenticate the CLI:

```bash
npx supabase login
```

3. Link the local repository to the project:

```bash
npx supabase link --project-ref YOUR-PROJECT-REF
```

4. Apply the migrations:

```bash
npx supabase db push
```

The migration files in `supabase/migrations` create the schema, booking engine, RLS policies, RPCs, realtime publication, and scheduled housekeeping.

## Load seed data

Open the Supabase dashboard **SQL Editor**, paste the contents of [`supabase/seed.sql`](../supabase/seed.sql), and run it. This loads the initial menu, areas, hours, and related content.

## Configure Vault and the email function

Create the Edge Function environment file:

```bash
cp supabase/.env.example supabase/.env
```

Edit `supabase/.env` with the Resend and site values. Keep these values consistent:

- `RESERVATION_TOKEN_SECRET` must match the Next.js value in `.env.local`.
- `WEBHOOK_SECRET` must match the `pinewood_webhook_secret` Vault value.
- `EMAIL_FROM` must use a domain verified in Resend.

Paste [`supabase/setup/vault_secrets.sql`](../supabase/setup/vault_secrets.sql) into the Supabase SQL Editor, replace its placeholders in the editor, and run it once. Never save real values in the tracked file; if you want a file, copy it to `supabase/setup/vault_secrets.local.sql`, which git ignores. The `pinewood_functions_url` value should use your project reference:

```text
https://YOUR-PROJECT-REF.supabase.co/functions/v1
```

Set the Edge Function secrets:

```bash
npx supabase secrets set --env-file supabase/.env
```

Deploy the reservation email function:

```bash
npx supabase functions deploy reservation-email --no-verify-jwt
```

The function intentionally uses the custom `x-webhook-secret` header. Do not remove the matching secret check or change `verify_jwt = false` in [`supabase/config.toml`](../supabase/config.toml) without updating the webhook design.

## Branches, seating and hours

Each of the three branches (Dhanmondi Road 6, Dhanmondi Road 27, Banani) has its own areas, tables and, when they differ, opening hours; availability is worked out per branch (migration `20260926000100_branches.sql`). A branch takes online bookings only once it has an active area with active tables. Fill in [`supabase/setup/branch_setup.sql`](../supabase/setup/branch_setup.sql) with the owners' real rooms, table sizes and hours; the areas in `seed.sql` are placeholders and deliberately belong to no branch.

Staff screens for hours, closures, blockouts and staff accounts are retired for now: manage those in the Table Editor (`opening_hours`, `hours_overrides`, `blockouts`, `staff_profiles`) or with the template's SQL.

### Deploy order for the September 2026 changes

1. Deploy the Edge Function: `npm run functions:deploy` (it understands the new `log_id` email field and still works with the old database).
2. Apply the migrations: `supabase db push` (`20260926000100_branches`, `20260926000200_email_delivery`, `20260926000300_data_integrity`, `20260926000400_security_hardening`).
3. Add each branch's real areas and tables with `supabase/setup/branch_setup.sql`, then switch off the placeholder areas that have no branch (step 5 in that file). Until they're off, a hand-made request could still hold seats in them; the website itself never offers them.
4. Deploy the website. Until step 3 is done for a branch, its booking form shows "no online slots" and asks guests to call.

## Configure staff authentication

In Supabase **Authentication**:

1. Set the Site URL to the local or production website URL.
2. Add `http://localhost:3000/**` and the production URL to redirect URLs.
3. Disable public sign-ups.
4. Configure invite and recovery email templates to route through `/auth/confirm`.
5. Turn on leaked-password protection (**Authentication → Passwords**); the Supabase security advisor flags it as off.

### Rotating the webhook secret

`WEBHOOK_SECRET` lives in three places and they must match: the Vault secret `pinewood_webhook_secret`, Render (`pinewood-backend` → Environment) and the Edge Function secrets. To rotate it (for example because an old value reached git history):

1. Generate a new value: `openssl rand -hex 32`.
2. Set it in Render and in the Edge Function (`npx supabase secrets set WEBHOOK_SECRET=...`).
3. Update Vault with the rotation line at the bottom of `supabase/setup/vault_secrets.sql`.
4. Update your local `supabase/.env` and `backend/.env`.

Emails queued in the minutes between steps 2 and 3 fail with 401 and are retried by the database (up to 3 attempts, 5 minutes apart), so do steps 2 and 3 back to back.

Create the first user in **Authentication -> Users -> Add user**. Then run the commented `staff_profiles` insert in [`supabase/setup/vault_secrets.sql`](../supabase/setup/vault_secrets.sql), replacing the email and name.

## Optional database type generation

After linking the project, generate Supabase TypeScript types with:

```bash
npm run db:types
```

The current application primarily uses hand-maintained domain types. Review the generated file before adopting it broadly.

Continue with [Supabase and Website Connection](supabase-website-connection.md), then [Website Initialization](website-initialization.md).
