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

In the Supabase SQL Editor, open [`supabase/setup/vault_secrets.sql`](../supabase/setup/vault_secrets.sql), replace its placeholders, and run it once. The `pinewood_functions_url` value should use your project reference:

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

## Configure staff authentication

In Supabase **Authentication**:

1. Set the Site URL to the local or production website URL.
2. Add `http://localhost:3000/**` and the production URL to redirect URLs.
3. Disable public sign-ups.
4. Configure invite and recovery email templates to route through `/auth/confirm`.

Create the first user in **Authentication -> Users -> Add user**. Then run the commented `staff_profiles` insert in [`supabase/setup/vault_secrets.sql`](../supabase/setup/vault_secrets.sql), replacing the email and name.

## Optional database type generation

After linking the project, generate Supabase TypeScript types with:

```bash
npm run db:types
```

The current application primarily uses hand-maintained domain types. Review the generated file before adopting it broadly.

Continue with [Supabase and Website Connection](supabase-website-connection.md), then [Website Initialization](website-initialization.md).
