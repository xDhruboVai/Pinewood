# Pine Wood

Website, reservation system and staff dashboard for Pine Wood Café & Restaurant, Dhanmondi.

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 + shadcn-style components · Supabase (Postgres, Auth, Realtime, RPCs, pg_cron, pg_net, Vault) · Render · Resend · Vercel

## Setup guides

- [Requirements Installation](docs/requirements-installation.md) - Python, project-local Node.js, and npm dependencies.
- [Supabase Setup](docs/supabase-setup.md) - project linking, migrations, seed data, Vault, secrets, auth, and Edge Functions.
- [Supabase and Website Connection](docs/supabase-website-connection.md) - environment variables and the application data flow.
- [Website Initialization](docs/website-initialization.md) - local configuration, verification, and running the website.
- [Testing and Code Quality](docs/testing.md) - unit, database and browser tests, typecheck, lint, and testing email safely.

## What's inside

| Area | Where |
| --- | --- |
| Public site: Home, Menu, Spaces, Visit, Privacy (English / বাংলা, day / evening ambiance) | `src/app/(site)` |
| Booking flow: live availability → 10-min slot hold → request → waitlist | `src/components/reserve/booking-flow.tsx`, `src/actions/reservation.ts` |
| Guest link from email: status, pre-order builder, cancellation request | `src/app/(site)/reservation/[token]` |
| Staff dashboard: reservations and menu (the other screens redirect to reservations) | `src/app/admin` |
| Database schema, booking engine, RLS, realtime, cron | `supabase/migrations` |
| Seed data (real Pine Wood menu, areas, hours) | `supabase/seed.sql` |
| Render webhook adapter and deployment service | `backend`, `render.yaml` |
| Email sender (Resend, bilingual templates, signed links) | `supabase/functions/reservation-email` |

### Frontend design

The look follows the printed Pinewood Cafe + Kitchen menu.

| Part | Details |
| --- | --- |
| Colours | Teal `#214e51` (pine), cream `#f5efe3`, mustard `#e6c34a`, wood `#7a5439`. Defined in `src/app/globals.css`. The older class names (`forest-*`, `timber-*`, `gold-*`) point at these colours, so both old and new names work. |
| Fonts | **Kaushan Script** for brush-script menu headings (`script` class), **Cormorant Garamond** for page and section titles (`display` class), **Fira Sans** for everything else. Bangla falls back to **Noto Serif Bengali** and **Hind Siliguri**. Loaded in `src/app/layout.tsx`. |
| Theme | Day (cream pages, teal header and footer) and evening (whole site teal). Auto switches at 6pm; visitors can change it in the footer. |
| Logo and images | `public/images/`: the oval badge logo (`logo-badge-green.png`, `logo-badge-cream.png`) and its tree (`logo-tree-*.png`), real photos in `photos/`, the printed-menu crops, and the printed menu pages in `menu/`. All photos are listed in `PHOTOS` in `src/lib/site.ts`. |
| Buttons | `src/components/ui/button.tsx`: uppercase labels, `primary`, `mustard`, `pine`, `outline`, `light`, `ghost`, `link`, `danger`, `subtle` variants. |

### Reservation lifecycle

```
Guest picks slot ──► slot_holds (10 min TTL, 1 per browser, 3 per network)
        │
        ▼ submits details
reservations.status = pending  (holds seats for 24h or until the slot starts)
        │  └─► email "request received"
        ▼ staff call the guest, press Confirm in /admin/reservations
status = confirmed ──► DB trigger ──► pg_net ──► Render ──► Edge Function ──► Resend
        │                                   email with signed pre-order link
        ▼ guest opens link (JWT, no account) → pre-orders until 60 min before
pre_orders ──► shown on the booking in /admin/reservations (realtime)
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
4. Paste `supabase/setup/vault_secrets.sql` into the SQL editor, fill in the webhook URL and a long random webhook secret there, and run it. Don't save real values in the tracked file (a `vault_secrets.local.sql` copy is git-ignored).

### 3. Resend (email)

1. Create an account at [resend.com](https://resend.com), add and verify your sending domain.
2. Create an API key.

### 4. Email service

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

The Supabase Edge Function remains the email worker and keeps the service-role database access. Deploy the Render adapter from this repository using the included `render.yaml`, then set `SUPABASE_EMAIL_FUNCTION_URL` to the deployed Supabase function URL and `WEBHOOK_SECRET` to the same value used by the Edge Function. Finally, run `supabase/setup/vault_secrets.sql` with the Render service URL so Postgres sends its webhook to Render.

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

**Frontend-only preview (no Supabase needed):** to look at the public pages without `.env.local`, start the dev server with sample data from `supabase/seed.sql`:

```bash
PW_PREVIEW=1 npm run dev
```

The admin dashboard also opens in this mode (`/admin`, signed in as a sample manager with sample bookings). Nothing is saved, and guest reservation links still need the real backend.

### 7. Deploy to Vercel

Import the repo in Vercel, add the four variables from `.env.example` (with `NEXT_PUBLIC_SITE_URL` set to the production domain), deploy, then attach your custom domain under **Settings → Domains**. Update `SITE_URL` in `supabase/.env` and re-run `supabase secrets set`.

### 8. Deploy the backend to Render

Create a Render Blueprint from this repository. Render will use `render.yaml` and deploy `backend` as a small Node service. Set `SUPABASE_EMAIL_FUNCTION_URL` and `WEBHOOK_SECRET` in the Render dashboard. The `/health` endpoint is public for Render health checks; `/ready` confirms both required secrets are configured.

## Before launch — content to confirm

- `supabase/seed.sql` items marked **CONFIRM**: seat counts per area, halal/vegetarian tags, chef specials, variant surcharges (e.g. double shot), sample add-ons.
- Reviews on the home page are in `src/lib/reviews.ts` (copied from Google Maps). The placeholder rows in the Supabase `reviews` table are no longer shown on the site.
- Photos: all photos are real. To add one, put it in `public/images/photos/`, add it to `PHOTOS` in `src/lib/site.ts`, and add its caption and alt text under `photos` in both dictionaries.
- Seating areas: the areas in `supabase/seed.sql` (fireplace, study, timber hall, rooftop) don't match the real rooms and need replacing.
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
- Pre-order links are HS256 JWTs bound to `reservations.token_version` and expire 7 days after the booking ends. Cancelled, rejected and expired bookings already refuse pre-orders and cancel requests, so links are not revoked automatically. To kill a leaked link, run `update public.reservations set token_version = token_version + 1 where reference = 'PW-XXXXXX';` in the SQL editor; the next email sent for that booking (e.g. Resend in the admin) carries a working link. Prices are always recomputed in the database.
- `/reservation/*` responses are `no-store`, `no-referrer` and `noindex`.
- Every page sends a Content-Security-Policy (`next.config.ts`): scripts only from the site itself, connections only to the site and Supabase, frames only for the Google Maps embed. Add any new outside service there, or the browser blocks it.
- Staff can change only a waitlist entry's status, managers can't change their own role or access, and dining tables are visible to staff only (migration `20260926000400_security_hardening`).
- Hold limits per network use the first `X-Forwarded-For` address, which Vercel sets itself. Behind a different host or proxy, check that it overwrites that header, or the limit can be sidestepped.

## Changelog

### Frontend redesign on the first version (September 2026)

The site was rolled back to the first build, then restyled with the design from the later printed-menu redesign. Page layouts and wording are still the first version's. Backend, Supabase and server code were not changed.

- Fonts: Kaushan Script, Cormorant Garamond and Fira Sans, with Noto Serif Bengali and Hind Siliguri for Bangla.
- Colours: teal, cream, mustard and wood tones from the printed menu, including the evening theme.
- Logo: the real Pinewood Cafe + Kitchen logo in the header, footer and admin; favicon and Apple icon made from the logo tree.
- Header: teal bar, uppercase links, "EN / বাংলা" language switch, mustard "Reserve a Table" button. The theme switch moved to the footer.
- Footer: teal, stacked logo, theme switch.
- Home hero (in the style of a printed menu page): the food photo fills the right side and fades into the green. Over it are a small script line ("From our kitchen"), the dish name as a large serif title, its description, and its price in mustard. Below sit a thin rule with the menu section name, and a handwritten "Open till …" note taken from today's hours. The dish is Pine 3 (`HERO_DISH` in `src/app/(site)/page.tsx`); its name, description and price come from the menu data. If the dish is missing, the hero falls back to the old headline. The component is `src/components/site/home-hero.tsx`.
- Header: added a Home link; the active link gets a mustard underline.
- Frontend preview mode: `PW_PREVIEW=1 npm run dev` renders the public pages with sample data from `supabase/seed.sql` (`src/lib/preview/`, switched on in `next.config.ts`), so the frontend can be checked without Supabase.

### Real photos and copy cleanup (September 2026)

- All illustrations replaced with Pinewood's own photos (`public/images/photos/`, listed in `PHOTOS` in `src/lib/site.ts`). The Spaces page is now a photo page of the real rooms and outdoor area. The home page shows "Inside Pinewood", a food photo next to the dishes, and the team photo.
- Invented or cliché copy removed in English and Bangla, and stylistic em dashes removed. The name is now "Pinewood", with "Since 2016" from the new logo.
- Home hero is now a slider. Swipe or use the arrows to move between dishes, and the name, description, price and section change with each slide. Dishes are set in `HERO_SLIDES` in `src/components/site/home-hero.tsx`.
- Light animation: sections fade up once as they scroll into view, photos zoom slightly on hover, and hero text slides in. All of it is CSS, and all of it is off for visitors who prefer reduced motion.
- New logo: the oval "Pinewood / Cafe + Kitchen / Since 2016" badge in the header, footer and staff pages (cream on green, green on cream), and a new favicon made from its tree.
- Hero slides: Pine 3, American Mac & Cheese and Brownie.
- Hero slider has no buttons: drag it with a finger or the mouse (it follows the pointer), use the arrow keys, or let it change on its own.
- Real Google Maps reviews on the home page (`src/lib/reviews.ts`), quoted word for word with a link to the listing. The placeholder reviews in the database are no longer shown.
- Header is now 80px tall so the badge logo has room.
- Outlet finder: outlets are listed in `OUTLETS` in `src/lib/site.ts` and shown on the Visit page (with a map per outlet), on the home page and in the footer. Only confirmed outlets appear on the live site.
- Home dishes are now cards you can swipe or drag (photo cards where a real photo exists, green text cards otherwise).
- New About page (`/about`), a four-column footer, and a diagonal photo panel on the home booking section.
- Navigation is now Home, Menu, Visit us, About us. The Spaces photos moved into Visit us (`/ambiance` redirects there).
- Lighter look: the short dashes under headings, link underlines and divider lines were removed; the active menu link shows a small dot.
- Editorial refinement: fewer boxes, labels and yellow; script headings in the Pinewood hand for a few section openers (the menu page is the reference and wasn't changed); asymmetric photo layouts; reviews as pull quotes; outlets as a plain directory; green page headers with a photo on Visit us, About us and Reserve.
- Pages reorganised around the navigation: Home (hero → dishes → rooms → reviews → booking), Menu (food only), Visit us (outlets → hours and map → call us), About us (story → what we serve → rooms → team → come and see us), Reserve (intro → form → good to know → call us). The room gallery moved from Visit us to About us.
- Outlets: Pinewood is now Dhanmondi Road 6 and Dhanmondi Road 27 (Road 12 and Banani closed). The booking form asks which outlet and passes it to staff in the booking notes until the backend supports outlets.
- Cream (day) is now the default look; visitors can still switch in the footer.
- Home hero rebuilt to match Saalim's reference design: full-screen photo behind a see-through header, Playfair Display dish name, Sacramento handwritten accents, Montserrat navigation with a mustard underline on the active link, mustard price with "/-".
- Booking form simplified to date, guests and time (then name, phone, email). The seating area is picked automatically and every booking uses the default length.
- Menu: printed-menu style on teal (brush-script category headings, uppercase dishes, mustard options, food photos beside Mains, Coffee and Desserts).
- Inner pages (Seating, Find Us): teal title band.
- Buttons: uppercase labels, squarer corners, new `mustard`, `pine` and `light` variants.
- Booking page: the date strip no longer pushes the page wider than the screen on phones.
- Images regenerated into `public/images/` (the folder had been removed by the rollback).
