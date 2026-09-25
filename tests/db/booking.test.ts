// Booking engine rules, tested against the real migrations (the database is the authority):
// assert_bookable_slot via hold_slot, create_reservation, capacity (peak_load), holds, locking.
import { describe, expect, it, beforeAll } from "vitest";
import { book, dhaka, hold, pwError, setStatus, standardFixture, openTestDb } from "./helpers";

const db = openTestDb();
let A: Record<string, string>;

beforeAll(async () => {
  A = (await standardFixture(db)).areas;
});

describe("date rules", () => {
  it("rejects a start in the past", async () => {
    await expect(hold(db, { area: A.d6, start: dhaka(-1, "12:00") })).rejects.toThrow(pwError("PW_TOO_SOON"));
  });
  it("rejects a start less than 60 minutes from now (today rule)", async () => {
    const soon = new Date(Date.now() + 30 * 60_000).toISOString();
    await expect(hold(db, { area: A.d6, start: soon })).rejects.toThrow(pwError("PW_TOO_SOON"));
  });
  it("accepts 30 days ahead and rejects 31 (booking window)", async () => {
    expect((await hold(db, { area: A.d6, start: dhaka(30, "12:00") })).hold_id).toBeTruthy();
    await expect(hold(db, { area: A.d6, start: dhaka(31, "12:00") })).rejects.toThrow(pwError("PW_TOO_FAR"));
  });
  it("rejects a date that is not a date", async () => {
    await expect(hold(db, { area: A.d6, start: "2026-02-30T12:00:00+06:00" })).rejects.toThrow(/date\/time field value out of range|invalid input syntax/);
  });
});

describe("time rules", () => {
  it("accepts the hour and half hour, rejects anything else", async () => {
    expect((await hold(db, { area: A.d6, start: dhaka(2, "12:00") })).hold_id).toBeTruthy();
    expect((await hold(db, { area: A.d6, start: dhaka(2, "12:30") })).hold_id).toBeTruthy();
    for (const t of ["12:15", "12:45", "12:01"]) {
      await expect(hold(db, { area: A.d6, start: dhaka(2, t) })).rejects.toThrow(pwError("PW_INVALID_SLOT"));
    }
  });
  it("rejects starts before opening and bookings that run past closing", async () => {
    await expect(hold(db, { area: A.d6, start: dhaka(2, "09:30") })).rejects.toThrow(pwError("PW_OUTSIDE_HOURS"));
    await expect(hold(db, { area: A.d6, start: dhaka(2, "21:00"), duration: 90 })).rejects.toThrow(pwError("PW_OUTSIDE_HOURS"));
    expect((await hold(db, { area: A.d6, start: dhaka(2, "20:30"), duration: 90 })).hold_id).toBeTruthy(); // ends 22:00
  });
  it("rejects a closed day and a special-hours closure", async () => {
    const day = dhaka(3, "12:00").slice(0, 10);
    await db.q("insert into public.hours_overrides (label, starts_on, ends_on, is_closed) values ('Test closure', $1, $1, true)", [day]);
    await expect(hold(db, { area: A.d6, start: dhaka(3, "12:00") })).rejects.toThrow(pwError("PW_OUTSIDE_HOURS"));
    const weekday = new Date(dhaka(4, "12:00")).getUTCDay();
    await db.q("update public.opening_hours set is_closed = true where weekday = $1 and branch_id is null", [weekday]);
    await expect(hold(db, { area: A.d6, start: dhaka(4, "12:00") })).rejects.toThrow(pwError("PW_OUTSIDE_HOURS"));
    await db.q("update public.opening_hours set is_closed = false where weekday = $1 and branch_id is null", [weekday]);
  });
  it("only allows the supported durations", async () => {
    await expect(hold(db, { area: A.d6, start: dhaka(2, "12:00"), duration: 45 })).rejects.toThrow(pwError("PW_INVALID_DURATION"));
  });
});

describe("party size", () => {
  it("accepts 1 and 10 (10 in a 12-seat test area)", async () => {
    await db.q("insert into public.dining_tables (area_id, label, seats) values ($1, 'BIG', 4)", [A.d27]); // d27: 4+4+4 = 12
    expect((await hold(db, { area: A.d27, start: dhaka(5, "12:00"), party: 1 })).hold_id).toBeTruthy();
    expect((await hold(db, { area: A.d27, start: dhaka(5, "15:00"), party: 10 })).hold_id).toBeTruthy();
  });
  it("rejects 0 and more than 10", async () => {
    await expect(hold(db, { area: A.d6, start: dhaka(5, "12:00"), party: 0 })).rejects.toThrow(pwError("PW_INVALID_PARTY"));
    await expect(hold(db, { area: A.d6, start: dhaka(5, "12:00"), party: 11 })).rejects.toThrow(pwError("PW_INVALID_PARTY"));
  });
  it("rejects an inactive or unknown area", async () => {
    await expect(hold(db, { area: "00000000-0000-4000-8000-000000000000", start: dhaka(5, "12:00") })).rejects.toThrow(pwError("PW_INVALID_AREA"));
  });
});

describe("guest details and notes (database checks behind the form)", () => {
  it("stores notes up to 500 characters, empty as null, and refuses 501", async () => {
    const a = await book(db, { area: A.banani, start: dhaka(6, "12:00"), requests: "x".repeat(500) });
    const b = await book(db, { area: A.banani, start: dhaka(6, "13:00"), requests: "   " });
    const rows = await db.q<{ id: string; special_requests: string | null }>("select id, special_requests from public.reservations where id = any($1)", [[a.id, b.id]]);
    expect(rows.find((r) => r.id === a.id)?.special_requests).toHaveLength(500);
    expect(rows.find((r) => r.id === b.id)?.special_requests).toBeNull();
    await expect(book(db, { area: A.banani, start: dhaka(6, "14:00"), requests: "x".repeat(501) })).rejects.toThrow(/special_requests/);
  });
  it("refuses a name, phone or email the form would also refuse", async () => {
    await expect(book(db, { area: A.banani, start: dhaka(6, "15:00"), name: "A" })).rejects.toThrow(/customer_name/);
    await expect(book(db, { area: A.banani, start: dhaka(6, "15:00"), phone: "01712345678" })).rejects.toThrow(/phone/);
    await expect(book(db, { area: A.banani, start: dhaka(6, "15:00"), email: "not-an-email" })).rejects.toThrow(/email/);
  });
  it("stores the email lower-cased and the name trimmed", async () => {
    const r = await book(db, { area: A.banani, start: dhaka(6, "16:00"), name: "  Nadia  ", email: "Nadia@Example.COM" });
    const [row] = await db.q("select customer_name, email, status, source from public.reservations where id = $1", [r.id]);
    expect(row).toEqual({ customer_name: "Nadia", email: "nadia@example.com", status: "pending", source: "web" });
  });
  it("allows at most 3 upcoming active bookings per phone", async () => {
    const phone = "+8801799000001";
    for (const t of ["12:00", "13:30", "15:00"]) await book(db, { area: A.banani, start: dhaka(7, t), phone });
    await expect(book(db, { area: A.banani, start: dhaka(7, "16:30"), phone })).rejects.toThrow(pwError("PW_TOO_MANY_ACTIVE"));
  });
});

describe("holds", () => {
  it("creates a 10-minute hold", async () => {
    const h = await hold(db, { area: A.d6, start: dhaka(8, "12:00") });
    const [row] = await db.q<{ mins: number }>("select round(extract(epoch from expires_at - created_at) / 60)::int as mins from public.slot_holds where id = $1", [h.hold_id]);
    expect(row.mins).toBe(10);
  });
  it("keeps one hold per browser: a second hold replaces the first", async () => {
    await hold(db, { area: A.d6, start: dhaka(8, "13:00"), client: "browser-1" });
    await hold(db, { area: A.d6, start: dhaka(8, "15:00"), client: "browser-1" });
    const rows = await db.q("select starts_at from public.slot_holds where client_key = 'browser-1'");
    expect(rows).toHaveLength(1);
  });
  it("allows 3 live holds per network, refuses a 4th", async () => {
    for (const c of ["n1", "n2", "n3"]) await hold(db, { area: A.d6, start: dhaka(9, "12:00"), client: c, ip: "same-network" });
    await expect(hold(db, { area: A.d6, start: dhaka(9, "12:00"), client: "n4", ip: "same-network" })).rejects.toThrow(pwError("PW_RATE_LIMITED"));
  });
  it("a hold can only be turned into a booking once, and only by the same browser", async () => {
    const h = await hold(db, { area: A.d6, start: dhaka(10, "12:00"), client: "owner" });
    const create = (client: string) =>
      db.as("service_role", "select * from public.create_reservation($1, $2, 'Guest', '+8801799000100', 'g@test.local', '', false, 'en')", [h.hold_id, client]);
    await expect(create("someone-else")).rejects.toThrow(pwError("PW_HOLD_NOT_FOUND"));
    expect(await create("owner")).toHaveLength(1);
    await expect(create("owner")).rejects.toThrow(pwError("PW_HOLD_NOT_FOUND"));
  });
  it("an expired hold still books if the seats are free, and is refused if they were taken", async () => {
    const h1 = await hold(db, { area: A.d6out, start: dhaka(10, "15:00"), party: 4, client: "late-1" });
    await db.q("update public.slot_holds set expires_at = now() - interval '1 minute' where id = $1", [h1.hold_id]);
    expect(await db.as("service_role", "select * from public.create_reservation($1, 'late-1', 'Guest', '+8801799000101', 'g@test.local', '', false, 'en')", [h1.hold_id])).toHaveLength(1);

    const h2 = await hold(db, { area: A.d6out, start: dhaka(10, "18:00"), party: 4, client: "late-2" });
    await db.q("update public.slot_holds set expires_at = now() - interval '1 minute' where id = $1", [h2.hold_id]);
    await book(db, { area: A.d6out, start: dhaka(10, "18:00"), party: 4 }); // someone else takes the 4 seats
    await expect(
      db.as("service_role", "select * from public.create_reservation($1, 'late-2', 'Guest', '+8801799000102', 'g@test.local', '', false, 'en')", [h2.hold_id]),
    ).rejects.toThrow(pwError("PW_HOLD_EXPIRED"));
  });
});

describe("capacity", () => {
  const start = dhaka(11, "19:00");
  const free = async (area: string, party = 1) => {
    const rows = await db.as<{ remaining: number }>(
      "anon",
      "select remaining from public.get_availability($1::date, $2, 90, (select branch_id from public.areas where id = $3)) where area_id = $3 and slot_start = $4",
      [start.slice(0, 10), party, area, start],
    );
    return rows[0]?.remaining;
  };

  it("counts holds, pending and confirmed bookings, and refuses when full", async () => {
    expect(await free(A.d6)).toBe(8);
    const a = await book(db, { area: A.d6, start, party: 4 });
    expect(await free(A.d6)).toBe(4);
    await setStatus(db, a.id, "confirmed");
    await hold(db, { area: A.d6, start, party: 2 });
    expect(await free(A.d6)).toBe(2);
    await expect(hold(db, { area: A.d6, start, party: 3 })).rejects.toThrow(pwError("PW_SLOT_FULL"));
    expect((await hold(db, { area: A.d6, start, party: 2 })).hold_id).toBeTruthy();
    expect(await free(A.d6)).toBe(0);
  });
  it("overlapping slots share capacity; a slot after the booking ends does not", async () => {
    await expect(hold(db, { area: A.d6, start: dhaka(11, "19:30"), party: 1 })).rejects.toThrow(pwError("PW_SLOT_FULL"));
    expect((await hold(db, { area: A.d6, start: dhaka(11, "20:30"), party: 4 })).hold_id).toBeTruthy();
  });
  it("expired holds and lapsed pending requests stop counting", async () => {
    const s = dhaka(12, "12:00");
    const h = await hold(db, { area: A.d6out, start: s, party: 4 });
    await expect(hold(db, { area: A.d6out, start: s, party: 1 })).rejects.toThrow(pwError("PW_SLOT_FULL"));
    await db.q("update public.slot_holds set expires_at = now() - interval '1 second' where id = $1", [h.hold_id]);
    const b = await book(db, { area: A.d6out, start: s, party: 4 });
    await expect(hold(db, { area: A.d6out, start: s, party: 1 })).rejects.toThrow(pwError("PW_SLOT_FULL"));
    await db.q("update public.reservations set expires_at = now() - interval '1 second' where id = $1", [b.id]);
    expect((await hold(db, { area: A.d6out, start: s, party: 4 })).hold_id).toBeTruthy();
  });
  it("a cancellation gives the seats back", async () => {
    const s = dhaka(12, "16:00");
    const b = await book(db, { area: A.d6out, start: s, party: 4 });
    await setStatus(db, b.id, "confirmed");
    await expect(hold(db, { area: A.d6out, start: s, party: 1 })).rejects.toThrow(pwError("PW_SLOT_FULL"));
    await setStatus(db, b.id, "cancelled");
    expect((await hold(db, { area: A.d6out, start: s, party: 4 })).hold_id).toBeTruthy();
  });
  it("a whole-branch blockout takes the seats; a blockout with a seat count takes only those", async () => {
    const s = dhaka(13, "12:00");
    const [branch] = await db.q<{ id: string }>("select branch_id as id from public.areas where id = $1", [A.d27]);
    // d27 has 12 seats (the party-size test added a table); a 10-seat blockout leaves 2.
    await db.q("insert into public.blockouts (area_id, starts_at, ends_at, seats, reason) values ($1, $2::timestamptz, $2::timestamptz + interval '2 hours', 10, 'Test')", [A.d27, s]);
    expect((await hold(db, { area: A.d27, start: s, party: 2 })).hold_id).toBeTruthy();
    await expect(hold(db, { area: A.d27, start: s, party: 1 })).rejects.toThrow(pwError("PW_SLOT_FULL"));
    const s2 = dhaka(13, "18:00");
    await db.q("insert into public.blockouts (area_id, branch_id, starts_at, ends_at, reason) values (null, $1, $2::timestamptz, $2::timestamptz + interval '2 hours', 'Private event')", [branch.id, s2]);
    await expect(hold(db, { area: A.d27, start: s2, party: 1 })).rejects.toThrow(pwError("PW_SLOT_FULL"));
  });
});

describe("concurrent attempts for the last seats", () => {
  it("the advisory lock serialises them: exactly one gets the seats", async () => {
    const s = dhaka(14, "19:00");
    const c1 = await db.connect();
    const c2 = await db.connect();
    const call = (c: typeof c1, key: string) =>
      c.query("select * from public.hold_slot($1, $2, 90, 4, $3, $4)", [A.d6out, s, key, `ip-${key}`]).then(
        () => "held",
        (e: Error) => (/PW_SLOT_FULL/.test(e.message) ? "full" : e.message),
      );
    try {
      await c1.query("begin; set local role service_role");
      await c2.query("begin; set local role service_role");
      const first = await call(c1, "first"); // takes the area lock, holds 4 seats, not yet committed
      const second = call(c2, "second"); // must wait for the lock
      const raced = await Promise.race([second.then(() => "finished"), new Promise((r) => setTimeout(() => r("waiting"), 700))]);
      expect(raced).toBe("waiting");
      await c1.query("commit");
      expect(first).toBe("held");
      expect(await second).toBe("full");
      await c2.query("rollback");
    } finally {
      await c1.end();
      await c2.end();
    }
    const [n] = await db.q<{ n: number }>("select count(*)::int as n from public.slot_holds where area_id = $1 and starts_at = $2", [A.d6out, s]);
    expect(n.n).toBe(1);
  });
});
