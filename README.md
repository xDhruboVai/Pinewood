# Pine Wood

Website, reservation system and staff dashboard for Pine Wood Café & Restaurant, Dhanmondi.

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 + shadcn-style components · Supabase (Postgres, Auth, Realtime, Edge Functions, pg_cron, pg_net, Vault) · Resend · Vercel

## What's inside

| Area | Where |
| --- | --- |
| Public site: Home, Menu, Spaces, Visit, Privacy (English / বাংলা, day / evening ambiance) | `src/app/(site)` |
| Booking flow: live availability → 10-min slot hold → request → waitlist | `src/components/reserve/booking-flow.tsx`, `src/actions/reservation.ts` |
| Guest link from email: status, pre-order builder, cancellation request | `src/app/(site)/reservation/[token]` |
| Staff dashboard: overview, reservations, kitchen, availability, menu, analytics, staff | `src/app/admin` |
| Database schema, booking engine, RLS, realtime, cron | `supabase/migrations` |
| Seed data (real Pine Wood menu, areas, hours) | `supabase/seed.sql` |
| Email sender (Resend, bilingual templates, signed links) | `supabase/functions/reservation-email` |

### Reservation lifecycle

```
Guest picks slot ──► slot_holds (10 min TTL, 1 per browser, 3 per network)
        │
        ▼ submits details
reservations.status = pending  (holds seats for 24h or until the slot starts)
        │  └─► email "request received"
        ▼ staff call the guest, press Confirm in /admin/reservations
status = confirmed ──► DB trigger ──► pg_net ──► Edge Function ──► Resend
        │                                   email with signed pre-order link
        ▼ guest opens link (JWT, no account) → pre-orders until 60 min before
pre_orders ──► /admin/kitchen (realtime)
        │
        ▼ pg_cron every 5 min: expire unconfirmed pendings (email + waitlist promotion),
          clean holds, send 2-hour reminders
```

When a slot is full but some of that load is still `pending`, guests can join the **waitlist**. When a pending/confirmed booking is cancelled, rejected, expires or completes early, the oldest fitting waitlist entry is promoted to a new pending reservation automatically.

## Setup

### 1. Install dependencies (virtual environment)

The only thing you need installed system-wide is **Python 3.9+** ([python.org](https://www.python.org/downloads/) — on Windows, tick "Add python.exe to PATH"). Everything else — Node.js, npm and the app's packages — is installed inside a project-local `.venv`.

Create the virtualenv:

```bash
python -m venv .venv
```

Activate it — **Windows (Git Bash):**

```bash
source .venv/Scripts/activate
```

Activate it — **macOS / Linux:**

```bash
source .venv/bin/activate
```

Install the Python requirements (`nodeenv`):

```bash
pip install -r requirements.txt
```

Install Node.js LTS into the same virtualenv:

```bash
nodeenv -p --node=lts
```

Check that Node and npm now come from `.venv`:

```bash
node -v && npm -v
```

Install the app's packages (from `package.json` into `node_modules/`):

```bash
npm install
```

From now on, run `source .venv/Scripts/activate` (or `source .venv/bin/activate`) in each new terminal before using `npm` or `npx`. Leave the environment with:

```bash
deactivate
```

The Supabase CLI needs no global install; run it through npx, e.g. `npx supabase --version`.

### 2. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com) — choose the **Singapore** region (closest to Dhaka).
2. Link and push the schema:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref YOUR-PROJECT-REF
```

```bash
npx supabase db push
```

3. Load the seed data: open **SQL Editor**, paste `supabase/seed.sql`, run.
4. Open `supabase/setup/vault_secrets.sql`, fill in your project URL and a long random webhook secret, and run it in the SQL editor.

### 3. Resend (email)

1. Create an account at [resend.com](https://resend.com), add and verify your sending domain.
2. Create an API key.

### 4. Edge Function

```bash
cp supabase/.env.example supabase/.env
```

Fill in `supabase/.env` (the `WEBHOOK_SECRET` must match the Vault secret; `RESERVATION_TOKEN_SECRET` must match the Next.js one), then:

```bash
npx supabase secrets set --env-file supabase/.env
```

```bash
npx supabase functions deploy reservation-email --no-verify-jwt
```

### 5. Auth settings (staff login)

In **Authentication → URL Configuration**, set Site URL to your domain and add `http://localhost:3000/**` and `https://yourdomain.com/**` to redirect URLs.

In **Authentication → Emails**, edit these templates so links go through `/auth/confirm`:

- **Invite user:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/admin/set-password`
- **Reset password:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/admin/set-password`

Disable public sign-ups (**Authentication → Sign In / Providers → Allow new users to sign up: off**). Staff are invited from `/admin/staff`.

**First manager:** create your user under **Authentication → Users → Add user**, then run the `insert into public.staff_profiles …` snippet at the bottom of `supabase/setup/vault_secrets.sql`.

### 6. Run locally

```bash
cp .env.example .env.local
```

Fill in `.env.local`, then:

```bash
npm run dev
```

Open http://localhost:3000 and http://localhost:3000/admin.

### 7. Deploy to Vercel

Import the repo in Vercel, add the four variables from `.env.example` (with `NEXT_PUBLIC_SITE_URL` set to the production domain), deploy, then attach your custom domain under **Settings → Domains**. Update `SITE_URL` in `supabase/.env` and re-run `supabase secrets set`.

## Before launch — content to confirm

- `supabase/seed.sql` items marked **CONFIRM**: seat counts per area, halal/vegetarian tags, chef specials, variant surcharges (e.g. double shot), sample add-ons.
- Replace the **placeholder reviews** (Supabase → Table Editor → `reviews`).
- Add real photos: put files in `public/images/` and set their paths in `PHOTOS` in `src/lib/site.ts`. Until then, illustrated scenes are shown.
- Check the address, phone numbers and Facebook link in `src/lib/site.ts`.

## Everyday operations

| Task | Where |
| --- | --- |
| Confirm / reject / seat / no-show | `/admin/reservations` |
| Hold seats for walk-ins | `/admin/availability` → Blockouts |
| Close the rooftop for rain | `/admin/availability` → untick the area |
| Ramadan / Eid hours | `/admin/availability` → Holiday & Ramadan hours |
| 86 a dish | `/admin/menu` |
| Add a dish, variant or add-on | Supabase → Table Editor (`menu_items`, `menu_item_variants`, `menu_item_addons`) |

## Security notes

- Guests never touch tables directly: booking RPCs are executable only by the service role, called from server actions after validation, honeypot and per-browser / per-network hold limits.
- Staff access is enforced in Postgres (`is_staff()` / `is_manager()` in RLS and in every admin RPC), not just in the UI.
- Pre-order links are HS256 JWTs bound to `reservations.token_version`; bump the version to revoke a link. Prices are always recomputed in the database.
- `/reservation/*` responses are `no-store`, `no-referrer` and `noindex`.
