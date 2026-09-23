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

This project currently has no configured lint or test scripts, so these are the minimum application checks.

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

For Vercel deployment, configure the variables from `.env.example` in the Vercel project, set `NEXT_PUBLIC_SITE_URL` to the production domain, and deploy. Keep the Edge Function secrets and `SITE_URL` aligned with the production website.

## Initialization checklist

- [ ] Python virtual environment is active.
- [ ] `npm install` completed.
- [ ] `.env.local` contains the linked Supabase values.
- [ ] Supabase migrations and seed data are loaded.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] The public site loads at `http://localhost:3000`.
- [ ] Staff authentication is configured before using `/admin` a.
