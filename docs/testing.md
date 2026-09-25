# Testing and Code Quality

Every check runs on your own machine against throwaway data. None of them talks to the real
Supabase project, Resend, Render or Vercel, and none needs the values in `.env.local`.

| Command | What it checks | Needs |
| --- | --- | --- |
| `npm run typecheck` | TypeScript across the site, tests and backend | nothing |
| `npm run lint` | ESLint with Next.js's recommended rules | nothing |
| `npm test` | Unit tests: validation, tokens, server actions, the email function | nothing |
| `npm run test:db` | The booking engine on a real local Postgres | nothing (downloads with `npm install`) |
| `npm run test:e2e` | Browser tests of the guest and staff journeys | a browser (below) |
| `npm run check` | typecheck + lint + unit + database tests | nothing |
| `npm run build` | Production build | `.env.local` with the real keys |

Run everything from the project environment (`source .venv/Scripts/activate` in Git Bash, see
[Requirements Installation](requirements-installation.md)).

## Tools

- **Vitest** runs both the unit tests (`tests/unit`) and the database tests (`tests/db`), as two
  projects in `vitest.config.mts`.
- **embedded-postgres** gives the database tests a real PostgreSQL 17 without Docker or the
  Supabase CLI. It is an npm package with the Postgres binaries.
- **Playwright** runs the browser tests (`tests/e2e`).
- **ESLint** uses `eslint-config-next` (`eslint.config.mjs`).

## Unit tests (`npm test`)

These cover the pure logic and the server-side code, with Supabase and Next.js mocked:

- form rules: party size, durations, names, Bangladesh phone numbers, email, notes up to 500
  characters, and the pre-order limits;
- guest link tokens: valid, forged, expired, wrong audience, old version;
- server actions:
  - what reaches the database and what never does, such as a price sent by the browser;
  - staff checks: signed out, front of house, manager;
  - friendly error messages, never raw database text;
- the `reservation-email` Edge Function, run in Node:
  - Deno is stubbed, Supabase is an in-memory fake and the Resend call is recorded, so no email
    is sent;
  - it covers the webhook secret, payload checks, the full kind/status matrix, the `email_log`
    lifecycle and Resend's idempotency key.

## Database tests (`npm run test:db`)

`tests/db/global-setup.ts` does the following:
1. Starts a temporary Postgres on a free port.
2. Runs every file in `supabase/migrations`, then `supabase/seed.sql`, into a template database.
   The migrations run unchanged, apart from the setup the stand-ins below replace.
3. Gives each test file its own copy of that database.

The data directory is deleted afterwards.

Supabase-only pieces are replaced by small stand-ins:
- the `auth` schema and `auth.uid()`;
- Vault;
- `net.http_post`, which records calls in `net.calls` instead of sending them;
- `pg_cron` and Realtime;
- the `anon`, `authenticated` and `service_role` roles with Supabase's default grants.

`pgcrypto` is the real extension.

The tests act as the same roles the site uses: `service_role` for server actions, `anon` for the
publishable key, and `authenticated` for staff. They cover:
- **Booking rules:** dates, times, half hours, opening hours and closures, party size, notes, guest
  details, holds and their limits.
- **Capacity and locking:** capacity, blockouts, and two simultaneous attempts on the last seats.
- **Status changes:** every one of the 56 possible pairs, plus the email each change queues.
- **Waitlist, housekeeping and email retries.**
- **Branches:** branch isolation and branch hours.
- **Pre-orders:** prices always come from the menu.
- **Permissions:** for every role.

All rows the tests create are test fixtures, not Pinewood data.

## Browser tests (`npm run test:e2e`)

`playwright.config.ts` starts two things:

1. `tests/e2e/fake-supabase.mjs`, a stateful stand-in for the Supabase endpoints the site calls
   (sign-in, tables, booking and staff functions), on port 54329.
2. A production build of the site in `.next/e2e`, pointed at that fake, on port 3210. Your normal
   `.next` build is not touched.

The test settings are in `playwright.config.ts` and only work against the fake. They are not
secrets: a publishable key, a secret key and a token secret, all made-up values.

The tests run on a desktop (1280 × 900) and a phone (Pixel 7) viewport:
- **Guests:** home → menu → visit → about → reserve → reference number; bad details; a bad time;
  the time wheel; no sideways scrolling.
- **Staff:**
  - signing in, and a wrong password being refused;
  - finding a booking, confirming it and cancelling a confirmed one;
  - menu price edits, including empty and zero prices;
  - signing out, including from the small-screen header.
- **Failures:**
  - guest links that are invalid, forged or out of date;
  - the database down (branded error page, then recovery);
  - free times not loading;
  - a failed hold;
  - staff lists not loading;
  - a refused staff action;
  - an expired staff session;
  - a 404.

Playwright needs a browser:

```bash
npx playwright install chromium
```

or use an installed Edge or Chrome instead:

```bash
PW_CHANNEL=msedge npm run test:e2e
```

The fake follows the booking rules only roughly. The real rules are tested in `tests/db`.

## Testing email safely

- The unit tests above never send email.
- To test real delivery, point a **separate** Supabase project, not production, at a Resend test
  domain. You can also send to Resend's test addresses, such as `delivered@resend.dev`.
- Never run the tests with production values in the environment. The test configs set their own
  values and don't read `.env.local`.

## Lint

`npm run lint` must report no errors. It currently shows 16 warnings from the React Compiler
readiness rules (`react-hooks/set-state-in-effect`, `refs`, `purity`,
`preserve-manual-memoization`). The site doesn't use the React Compiler. The patterns they flag
are deliberate and tested:
- reading browser-only state after the first render;
- "latest callback" refs;
- `Date.now()` for time-dependent labels.

They are left as warnings rather than rewritten. `eslint.config.mjs` explains why.
