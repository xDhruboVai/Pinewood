// Per-file test database (a copy of the migrated template) and helpers for acting as the roles the
// app uses: service_role (server actions), anon (publishable key), authenticated (staff or not).
// All rows created here are TEST FIXTURES, not Pinewood business data.
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, inject } from "vitest";

export type Role = "service_role" | "anon" | "authenticated";

export interface TestDb {
  /** Superuser query (setup and inspection). */
  q<T extends pg.QueryResultRow = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Run one statement as an API role, optionally signed in as a user (auth.uid()). */
  as<T extends pg.QueryResultRow = Record<string, unknown>>(role: Role, sql: string, params?: unknown[], userId?: string): Promise<T[]>;
  /** A second, independent connection (for concurrency tests). */
  connect(): Promise<pg.Client>;
}

/** Opens a fresh copy of the migrated database for this test file. */
export function openTestDb(): TestDb {
  const port = inject("pgPort");
  const name = `t_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const cfg = { host: "127.0.0.1", port, user: "postgres", password: "postgres" };
  let client: pg.Client;

  beforeAll(async () => {
    const admin = new pg.Client({ ...cfg, database: "postgres" });
    await admin.connect();
    await admin.query(`create database ${name} template pinewood_template`);
    await admin.end();
    client = new pg.Client({ ...cfg, database: name });
    await client.connect();
  });
  afterAll(async () => {
    await client?.end();
  });

  const db: TestDb = {
    q: async (sql, params) => (await client.query(sql, params)).rows,
    as: async (role, sql, params, userId) => {
      await client.query("begin");
      try {
        await client.query(`set local role ${role}`);
        await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
        const rows = (await client.query(sql, params)).rows;
        await client.query("commit");
        return rows;
      } catch (e) {
        await client.query("rollback");
        throw e;
      }
    },
    connect: async () => {
      const c = new pg.Client({ ...cfg, database: name });
      await c.connect();
      return c;
    },
  };
  return db;
}

/** A start time in Dhaka `days` from today at "HH:MM", as an ISO string with +06:00. */
export function dhaka(days: number, time: string) {
  const d = new Date(Date.now() + days * 86_400_000);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return `${date}T${time}:00+06:00`;
}

export const TEST_BRANCHES = ["dhanmondi-6", "dhanmondi-27", "banani"] as const;

/**
 * TEST FIXTURE set-up: every day open 10:00-22:00 (shared hours), the seed's areas switched off, and
 * one test area per branch with two 4-seat tables (8 seats), plus a second area in Dhanmondi 6
 * (outside, 4 seats). Returns the area ids by key.
 */
export async function standardFixture(db: TestDb) {
  await db.q("update public.opening_hours set opens_at = '10:00', closes_at = '22:00', is_closed = false where branch_id is null");
  await db.q("update public.areas set is_active = false");
  const areas: Record<string, string> = {};
  const make = async (key: string, branch: string, seating: "inside" | "outside", seats: number[]) => {
    const [a] = await db.q<{ id: string }>(
      `insert into public.areas (slug, name_en, name_bn, seating, branch_id, sort_order)
       select $1, $1, $1, $2, b.id, 1 from public.branches b where b.slug = $3 returning id`,
      [`test-${key}`, seating, branch],
    );
    for (const [i, s] of seats.entries()) await db.q("insert into public.dining_tables (area_id, label, seats) values ($1, $2, $3)", [a.id, `T${i + 1}`, s]);
    areas[key] = a.id;
  };
  await make("d6", "dhanmondi-6", "inside", [4, 4]);
  await make("d6out", "dhanmondi-6", "outside", [4]);
  await make("d27", "dhanmondi-27", "inside", [4, 4]);
  await make("banani", "banani", "inside", [4, 4]);
  const branches = Object.fromEntries((await db.q<{ slug: string; id: string }>("select slug, id from public.branches")).map((b) => [b.slug, b.id]));
  return { areas, branches };
}

export interface HoldArgs {
  area: string;
  start: string;
  party?: number;
  duration?: number;
  client?: string;
  ip?: string;
}

/** hold_slot as the website's server calls it (service role). */
export async function hold(db: TestDb, a: HoldArgs) {
  const [row] = await db.as<{ hold_id: string; expires_at: string }>(
    "service_role",
    "select * from public.hold_slot($1, $2, $3, $4, $5, $6)",
    [a.area, a.start, a.duration ?? 90, a.party ?? 2, a.client ?? `client-${randomUUID()}`, a.ip ?? `ip-${randomUUID()}`],
  );
  return row;
}

let phoneSeq = 0;
/** hold_slot + create_reservation, as the booking form does. Returns the new booking. */
export async function book(db: TestDb, a: HoldArgs & { phone?: string; name?: string; email?: string; requests?: string }) {
  const client = a.client ?? `client-${randomUUID()}`;
  const h = await hold(db, { ...a, client });
  const phone = a.phone ?? `+88017${String(10_000_000 + ++phoneSeq).slice(-8)}`;
  const [r] = await db.as<{ reservation_id: string; reference: string }>(
    "service_role",
    "select * from public.create_reservation($1, $2, $3, $4, $5, $6, false, 'en')",
    [h.hold_id, client, a.name ?? "Test Guest", phone, a.email ?? "guest@test.local", a.requests ?? ""],
  );
  return { id: r.reservation_id, reference: r.reference, holdId: h.hold_id, phone };
}

/** Make a staff member (TEST user) and return their user id. */
export async function staffUser(db: TestDb, role: "owner" | "manager" | "foh" | null, active = true) {
  const id = randomUUID();
  await db.q("insert into auth.users (id, email) values ($1, $2)", [id, `${id}@test.local`]);
  if (role) await db.q("insert into public.staff_profiles (user_id, full_name, role, is_active) values ($1, 'Test Staff', $2, $3)", [id, role, active]);
  return id;
}

export async function branchManagerForArea(db: TestDb, areaId: string) {
  const id = await staffUser(db, "manager");
  await db.q(
    "update public.staff_profiles set branch_id = (select branch_id from public.areas where id = $2) where user_id = $1",
    [id, areaId],
  );
  return id;
}

/** Status change through the staff RPC (as a manager unless a user is given). */
export async function setStatus(db: TestDb, id: string, status: string, userId?: string) {
  const [booking] = userId ? [] : await db.q<{ area_id: string }>("select area_id from public.reservations where id = $1", [id]);
  const uid = userId ?? (await branchManagerForArea(db, booking.area_id));
  await db.as("authenticated", "select public.admin_set_status($1, $2::public.reservation_status, null)", [id, status], uid);
}

/** Point Vault at a (fake) email function so emails are dispatched (recorded in net.calls). */
export async function enableEmail(db: TestDb) {
  await db.q(
    "insert into vault.secrets (name, secret) values ('pinewood_functions_url', 'https://email.test/functions/v1'), ('pinewood_webhook_secret', 'test-secret') on conflict (name) do nothing",
  );
}

export const pwError = (code: string) => new RegExp(code);
