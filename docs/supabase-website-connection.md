# Supabase and Website Connection

Pine Wood connects its Next.js website to Supabase through environment variables and purpose-specific clients. The connection is split deliberately between public reads, authenticated staff access, and privileged server operations.

## Environment variables

Create the website environment file:

```bash
cp .env.example .env.local
```

Set these values in `.env.local`:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SECRET_KEY=sb_secret_xxx
RESERVATION_TOKEN_SECRET=change-me-to-a-long-random-string
```

Use the Supabase dashboard **Project Settings -> API Keys** for the URL and keys. `SUPABASE_SECRET_KEY` is server-only and must never be exposed to browser code.

The Edge Function has its own secrets in `supabase/.env`; see [Supabase Setup](supabase-setup.md). Its `RESERVATION_TOKEN_SECRET` must equal the website value.

## Client boundaries

- `src/lib/supabase/server.ts` provides the cookie-backed session client for staff authentication, a cookie-free public client for public reads, and the privileged client for validated server actions.
- `src/lib/supabase/client.ts` provides the browser client for availability, realtime refresh, login, and admin board interactions.
- `src/lib/supabase/proxy.ts` refreshes staff sessions for `/admin` routes through [`src/proxy.ts`](../src/proxy.ts).
- `src/lib/data.ts` reads public menu, hours, branch, and area data on the server (cached, see below). Availability is read by the booking form in the browser, never cached.

## Request and data flow

### Public pages

Public pages use server-side reads through the publishable Supabase key. Public data remains subject to database permissions and should not be fetched with the service-role key from a browser component.

#### Public data cache

Pages are still rendered per request (the language comes from a cookie), but the public reads in `src/lib/data.ts` are kept in the Next.js data cache instead of querying Supabase on every visit.

| Read | Tag | Kept for | Expired at once by |
| --- | --- | --- | --- |
| Menu (categories, dishes, sizes, add-ons) | `menu` | 5 min | `updateMenuItem` (admin Menu: availability, home page, price) |
| Weekly hours, special hours, schedule | `hours` | 5 min | `updateOpeningHours`, `createHoursOverride`, `deleteHoursOverride` |
| Areas | `areas` | 5 min | `toggleArea` |
| Branches | `branches` | 5 min | (no admin action edits branches) |

- The tags and the 5-minute limit are in `src/lib/cache-tags.ts`; the actions call `updateTag`, so the next page view after a change reads the database.
- Worst case: a change made straight in Supabase (a new dish, a branch's areas or hours from `supabase/setup/branch_setup.sql`) shows on the site within 5 minutes. A change made through the admin screens shows on the next page view.
- The schedule's cache key includes today's Dhaka date, so it never carries yesterday's hours past midnight.
- The admin Menu screen reads the menu straight from the database (`getMenuFresh`), not the cached copy.
- Not cached, by design: availability (`get_availability`), holds, bookings, pre-orders and everything in the staff dashboard. The guest's booking page reads the booking fresh; only its pre-order dish list is the cached menu, and the database checks each dish's availability and price when the pre-order is saved. Capacity is always checked by the database when seats are held (`hold_slot`), so a cached menu or area list can never cause an overbooking.

### Guest booking

1. The browser booking flow requests availability and holds through the existing UI.
2. [`src/actions/reservation.ts`](../src/actions/reservation.ts) validates input and derives the browser and network identity.
3. The action calls booking RPCs with the privileged server client.
4. Postgres enforces capacity, hold limits, reservation state, and related transitions.

Do not replace this flow with direct browser writes to booking tables.

### Staff dashboard

1. Staff authentication uses the session-aware server client.
2. The admin layout calls `requireStaff()` before rendering the dashboard.
3. Admin actions call authenticated RPCs or permitted table operations.
4. RLS, `is_staff()`, `is_manager()`, RPC checks, and triggers remain the final authorization boundary.

### Reservation emails

Database triggers enqueue email work through `pg_net`. The reservation email Edge Function reads its Supabase service credentials automatically, validates `x-webhook-secret`, creates signed links, and sends through Resend.

### Realtime

Availability and staff boards use Supabase Realtime. The publication and trigger definitions are in the migrations, so changes to realtime tables or events must be coordinated with the affected client components.

## Troubleshooting checks

- Verify `NEXT_PUBLIC_SUPABASE_URL` points to the linked project.
- Verify the publishable key is from the same project as the URL.
- Verify `SUPABASE_SECRET_KEY` exists only in server-side environment configuration.
- Compare both `RESERVATION_TOKEN_SECRET` values exactly.
- Compare `WEBHOOK_SECRET` with the Vault `pinewood_webhook_secret` value exactly.
- Confirm migrations were pushed and seed data was loaded.
- Confirm the Edge Function was deployed with `--no-verify-jwt`.

For the complete provisioning sequence, see [Supabase Setup](supabase-setup.md).
