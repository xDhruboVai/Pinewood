# Website Initialization

Use this guide to initialize and run the Pine Wood website after installing requirements and connecting Supabase.

## 1. Activate the project environment

Windows Git Bash:

```bash
source .venv/Scripts/activate
```

Windows PowerShell:

```powershell
.venv\\Scripts\\Activate.ps1
```

See [Requirements Installation](requirements-installation.md) if `.venv` does not exist.

## 2. Create local website configuration

Copy the template:

```bash
cp .env.example .env.local
```

Set the Supabase URL, publishable key, server-only secret key, site URL, and reservation token secret. Follow [Supabase and Website Connection](supabase-website-connection.md) for the variable meanings.

## 3. Confirm dependencies

```bash
npm install
```

## 4. Verify the application

Run the TypeScript check:

```bash
npm run typecheck
```

Build the production bundle:

```bash
npm run build
```

Lint and the automated tests (none of them need the real Supabase project):

```bash
npm run check
```

`npm run check` runs the typecheck, lint, unit tests and database tests. Browser tests: `npm run test:e2e`. See [Testing and Code Quality](testing.md).

## 5. Start the development server

```bash
npm run dev
```

Open:

- Public website: http://localhost:3000
- Staff dashboard: http://localhost:3000/admin

## 6. Production start

After a successful build:

```bash
npm run start
```

For Vercel deployment, configure the variables from `.env.example` in the Vercel project, set `NEXT_PUBLIC_SITE_URL` to the production domain, and deploy. The Next.js app remains the frontend and keeps its Server Actions on Vercel.

## 7. Deploy the Render backend

The Render service lives in `backend/` and is described by `render.yaml`.

1. Create a Render Blueprint from this repository.
2. Set `SUPABASE_EMAIL_FUNCTION_URL` to `https://YOUR-PROJECT-REF.supabase.co/functions/v1/reservation-email`.
3. Set `WEBHOOK_SECRET` to the same long random value used by the Supabase Edge Function and Vault.
4. Confirm `https://YOUR-RENDER-SERVICE.onrender.com/health` returns `{ "ok": true }`.
5. Set the Vault secret `pinewood_functions_url` to the Render service URL: paste `supabase/setup/vault_secrets.sql` into the Supabase SQL Editor and fill in the values there (or use the `vault.update_secret` lines at its end). Do not save real values in the tracked file.

Render owns the webhook boundary; Supabase remains the database, authorization, booking state machine, realtime layer, scheduled jobs, and email worker. This avoids duplicating booking logic between platforms.

## Initialization checklist

- [ ] Python virtual environment is active.
- [ ] `npm install` completed.
- [ ] `.env.local` contains the linked Supabase values.
- [ ] Supabase migrations and seed data are loaded.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] The public site loads at `http://localhost:3000`.
- [ ] Staff authentication is configured before using `/admin`.
- [ ] The Render backend health check passes.
- [ ] Supabase Vault points `pinewood_functions_url` at the Render service.
