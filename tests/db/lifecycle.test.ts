// Reservation lifecycle: every status transition (the reservations_before_status trigger decides),
// which email each change queues, waitlist promotion, housekeeping and the email retry queue.
import { beforeAll, describe, expect, it } from "vitest";
import { book, dhaka, enableEmail, hold, pwError, setStatus, staffUser, standardFixture, openTestDb } from "./helpers";

const db = openTestDb();
let A: Record<string, string>;
let big: string;
let manager: string;
let slotN = 0;
// Spread bookings over days and times so capacity and the per-phone limit never interfere.
const nextStart = () => {
  const n = slotN++;
  return dhaka(1 + (n % 28), `${String(10 + Math.floor(n / 28) % 10).padStart(2, "0")}:${n % 2 ? "30" : "00"}`);
};

beforeAll(async () => {
  A = (await standardFixture(db)).areas;
  // TEST FIXTURE: a large area so the transition matrix never runs out of seats.
  const [a] = await db.q<{ id: string }>(
    "insert into public.areas (slug, name_en, name_bn, seating, branch_id) select 'test-hall', 'Test hall', 'Test hall', 'inside', id from public.branches where slug = 'banani' returning id",
  );
  big = a.id;
  await db.q("insert into public.dining_tables (area_id, label, seats) select $1, 'H' || g, 10 from generate_series(1, 20) g", [big]);
  manager = await staffUser(db, "manager");
  await enableEmail(db);
});

const status = async (id: string) => (await db.q<{ status: string }>("select status from public.reservations where id = $1", [id]))[0].status;
const emails = async (id: string) =>
  (await db.q<{ kind: string }>("select kind from public.email_log where reservation_id = $1 order by id", [id])).map((r) => r.kind);

/** A booking brought to `target` through legal steps. */
async function bookingIn(target: string) {
  const b = await book(db, { area: big, start: nextStart(), party: 2 });
  const path: Record<string, string[]> = {
    pending: [],
    confirmed: ["confirmed"],
    seated: ["confirmed", "seated"],
    completed: ["confirmed", "seated", "completed"],
    no_show: ["confirmed", "no_show"],
    cancelled: ["cancelled"],
    rejected: ["rejected"],
    expired: ["expired"],
  };
  for (const s of path[target]) await setStatus(db, b.id, s, manager);
  return b.id;
}

describe("status transitions (every pair)", () => {
  // From the migration (reservation_before_status): the only legal moves.
  const LEGAL: Record<string, string[]> = {
    pending: ["confirmed", "rejected", "cancelled", "expired"],
    confirmed: ["seated", "cancelled", "no_show", "completed"],
    seated: ["completed"],
  };
  const ALL = ["pending", "confirmed", "seated", "completed", "cancelled", "rejected", "expired", "no_show"];
  const pairs = ALL.flatMap((from) => ALL.filter((to) => to !== from).map((to) => [from, to, (LEGAL[from] ?? []).includes(to)] as const));

  it.each(pairs)("%s -> %s allowed: %s", async (from, to, legal) => {
    const id = await bookingIn(from);
    const attempt = setStatus(db, id, to, manager);
    if (legal) {
      await attempt;
      expect(await status(id)).toBe(to);
    } else {
      await expect(attempt).rejects.toThrow(pwError("PW_INVALID_TRANSITION"));
      expect(await status(id)).toBe(from);
    }
  });

  it("stamps the time of each step and who confirmed", async () => {
    const id = await bookingIn("completed");
    const [r] = await db.q("select confirmed_at is not null c, confirmed_by, seated_at is not null s, completed_at is not null d, expires_at from public.reservations where id = $1", [id]);
    expect(r).toEqual({ c: true, confirmed_by: manager, s: true, d: true, expires_at: null });
  });

  it("re-checks capacity when confirming a request whose 24h hold lapsed", async () => {
    const s = dhaka(20, "12:00");
    const lapsed = await book(db, { area: A.d6out, start: s, party: 4 });
    await db.q("update public.reservations set expires_at = now() - interval '1 minute' where id = $1", [lapsed.id]);
    const other = await book(db, { area: A.d6out, start: s, party: 4 }); // seats re-sold
    await setStatus(db, other.id, "confirmed", manager);
    await expect(setStatus(db, lapsed.id, "confirmed", manager)).rejects.toThrow(pwError("PW_SLOT_FULL"));
  });
});

describe("emails queued by status changes (with Vault configured)", () => {
  it("received on a new request, confirmed on confirm, nothing for seated/completed", async () => {
    const id = await bookingIn("completed");
    expect(await emails(id)).toEqual(["received", "confirmed"]);
  });
  it.each(["cancelled", "rejected", "expired"])("a %s booking gets the cancellation email", async (s) => {
    expect(await emails(await bookingIn(s))).toEqual(["received", "cancelled"]);
  });
  it("no email for a no-show", async () => {
    expect(await emails(await bookingIn("no_show"))).toEqual(["received", "confirmed"]);
  });
  it("each email is one queued row, posted once to the email function with its log id", async () => {
    const id = await bookingIn("pending");
    const [row] = await db.q<{ id: number; status: string; attempts: number }>("select id, status, attempts from public.email_log where reservation_id = $1", [id]);
    expect(row).toMatchObject({ status: "queued", attempts: 1 });
    const calls = await db.q<{ url: string; body: Record<string, unknown>; headers: Record<string, string> }>("select url, body, headers from net.calls where body->>'reservation_id' = $1", [id]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://email.test/functions/v1/reservation-email");
    expect(calls[0].body).toEqual({ reservation_id: id, kind: "received", log_id: Number(row.id) });
    expect(calls[0].headers["x-webhook-secret"]).toBe("test-secret");
  });
  it("staff resend: confirmed resends 'confirmed', pending resends 'received', others are refused", async () => {
    const c = await bookingIn("confirmed");
    const p = await bookingIn("pending");
    const x = await bookingIn("cancelled");
    for (const id of [c, p]) await db.as("authenticated", "select public.admin_resend_email($1)", [id], manager);
    expect((await emails(c)).at(-1)).toBe("confirmed");
    expect((await emails(p)).at(-1)).toBe("received");
    await expect(db.as("authenticated", "select public.admin_resend_email($1)", [x], manager)).rejects.toThrow(pwError("PW_INVALID_TRANSITION"));
  });
  it("cancelling a booking cancels its pre-order", async () => {
    const id = await bookingIn("confirmed");
    await db.q("insert into public.pre_orders (reservation_id, status, total) values ($1, 'submitted', 100)", [id]);
    await setStatus(db, id, "cancelled", manager);
    expect((await db.q("select status from public.pre_orders where reservation_id = $1", [id]))[0].status).toBe("cancelled");
  });
});

describe("waitlist", () => {
  const join = (start: string, phone: string) =>
    db.as("service_role", "select public.join_waitlist($1, $2, 90, 4, 'Wait Guest', $3, 'w@test.local', false, 'en') as id", [A.d6out, start, phone]);

  it("only when the slot is full and some of it is still unconfirmed", async () => {
    const s = dhaka(21, "12:00");
    await expect(join(s, "+8801788000001")).rejects.toThrow(pwError("PW_SLOT_AVAILABLE"));
    const b = await book(db, { area: A.d6out, start: s, party: 4 });
    await setStatus(db, b.id, "confirmed", manager);
    await expect(join(s, "+8801788000001")).rejects.toThrow(pwError("PW_NOT_WAITLISTABLE"));
  });

  it("a guest joins once per slot, and is promoted (with an email) when the seats free up", async () => {
    const s = dhaka(21, "18:00");
    const pending = await book(db, { area: A.d6out, start: s, party: 4 });
    const [{ id: entry }] = await join(s, "+8801788000002");
    await expect(join(s, "+8801788000002")).rejects.toThrow(pwError("PW_ALREADY_WAITLISTED"));

    await setStatus(db, pending.id, "rejected", manager); // frees the 4 seats
    const [w] = await db.q<{ status: string; promoted_reservation_id: string }>("select status, promoted_reservation_id from public.waitlist_entries where id = $1", [entry]);
    expect(w.status).toBe("promoted");
    const [r] = await db.q("select status, source, phone from public.reservations where id = $1", [w.promoted_reservation_id]);
    expect(r).toEqual({ status: "pending", source: "waitlist", phone: "+8801788000002" });
    expect(await emails(w.promoted_reservation_id)).toEqual(["waitlist_promoted"]);
  });
});

describe("housekeeping (run every 5 minutes by pg_cron)", () => {
  const run = () => db.q("select public.run_housekeeping()");

  it("expires requests staff never answered, emails the guest and frees the seats", async () => {
    const s = dhaka(22, "12:00");
    const b = await book(db, { area: A.d6out, start: s, party: 4 });
    await db.q("update public.reservations set expires_at = now() - interval '1 minute' where id = $1", [b.id]);
    await run();
    const [r] = await db.q("select status, cancel_reason from public.reservations where id = $1", [b.id]);
    expect(r).toEqual({ status: "expired", cancel_reason: "We could not reach you to confirm in time." });
    expect(await emails(b.id)).toEqual(["received", "cancelled"]);
    expect((await hold(db, { area: A.d6out, start: s, party: 4 })).hold_id).toBeTruthy();
  });

  it("clears holds more than 5 minutes past expiry and keeps newer ones", async () => {
    const old = await hold(db, { area: A.d6, start: dhaka(23, "12:00") });
    const recent = await hold(db, { area: A.d6, start: dhaka(23, "13:00") });
    await db.q("update public.slot_holds set expires_at = now() - interval '6 minutes' where id = $1", [old.hold_id]);
    await db.q("update public.slot_holds set expires_at = now() - interval '1 minute' where id = $1", [recent.hold_id]);
    await run();
    const left = (await db.q<{ id: string }>("select id from public.slot_holds where id = any($1)", [[old.hold_id, recent.hold_id]])).map((r) => r.id);
    expect(left).toEqual([recent.hold_id]);
  });

  it("expires waitlist entries within 30 minutes of their slot", async () => {
    const [w] = await db.q<{ id: string }>(
      "insert into public.waitlist_entries (area_id, starts_at, ends_at, party_size, customer_name, phone, email) values ($1, now() + interval '20 minutes', now() + interval '110 minutes', 2, 'Late', '+8801788000009', 'l@test.local') returning id",
      [A.d6],
    );
    await run();
    expect((await db.q("select status from public.waitlist_entries where id = $1", [w.id]))[0].status).toBe("expired");
  });

  it("sends one reminder 2 hours before, skipping guests confirmed within the last 3 hours", async () => {
    const insert = (confirmedAgo: string) =>
      db.q<{ id: string }>(
        `insert into public.reservations (area_id, starts_at, ends_at, party_size, customer_name, phone, email, status, confirmed_at)
         values ($1, now() + interval '90 minutes', now() + interval '180 minutes', 2, 'Soon', '+8801788000010', 's@test.local', 'confirmed', now() - $2::interval) returning id`,
        [A.d27, confirmedAgo],
      );
    const [longAgo] = await insert("2 days");
    const [justNow] = await insert("10 minutes");
    await run();
    await run();
    expect(await emails(longAgo.id)).toEqual(["reminder"]);
    expect(await emails(justNow.id)).toEqual([]);
  });

  it("retries an unanswered email after 10 minutes, up to 3 attempts, then marks it failed", async () => {
    const id = await bookingIn("pending");
    const [row] = await db.q<{ id: string }>("select id from public.email_log where reservation_id = $1", [id]);
    const age = () => db.q("update public.email_log set last_attempt_at = now() - interval '11 minutes' where id = $1", [row.id]);
    const state = async () => (await db.q<{ status: string; attempts: number }>("select status, attempts from public.email_log where id = $1", [row.id]))[0];
    await run();
    expect(await state()).toEqual({ status: "queued", attempts: 1 }); // too soon to retry
    await age();
    await run();
    expect(await state()).toEqual({ status: "queued", attempts: 2 });
    await age();
    await run();
    expect(await state()).toEqual({ status: "queued", attempts: 3 });
    await age();
    await run();
    expect(await state()).toMatchObject({ status: "failed", attempts: 3 });
    const posts = await db.q("select 1 from net.calls where (body->>'log_id')::bigint = $1", [row.id]);
    expect(posts).toHaveLength(3);
  });

  it("without Vault secrets, emails are logged as skipped rather than lost silently", async () => {
    await db.q("delete from vault.secrets");
    const id = await bookingIn("pending");
    expect((await db.q("select status, error from public.email_log where reservation_id = $1", [id]))[0]).toMatchObject({ status: "skipped" });
    await enableEmail(db);
  });
});
