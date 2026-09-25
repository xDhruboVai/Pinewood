// Branch -> area -> tables/capacity -> availability -> reservation. The three branch rows come from
// the branches migration; areas, tables and hours below are TEST FIXTURES (the real ones still have
// to be entered with supabase/setup/branch_setup.sql).
import { beforeAll, describe, expect, it } from "vitest";
import { book, dhaka, hold, pwError, setStatus, staffUser, standardFixture, openTestDb } from "./helpers";

const db = openTestDb();
let A: Record<string, string>;
let B: Record<string, string>;

beforeAll(async () => {
  ({ areas: A, branches: B } = await standardFixture(db));
});

const avail = (branch: string | null, start: string, party = 1) =>
  db.as<{ area_id: string; remaining: number; available: boolean }>(
    "anon",
    "select area_id, remaining, available from public.get_availability($1::date, $2, 90, $3) where slot_start = $4",
    [start.slice(0, 10), party, branch, start],
  );

describe("branch isolation", () => {
  it("each branch's availability lists only its own areas", async () => {
    const s = dhaka(2, "19:00");
    expect((await avail(B["dhanmondi-6"], s)).map((r) => r.area_id).sort()).toEqual([A.d6, A.d6out].sort());
    expect((await avail(B.banani, s)).map((r) => r.area_id)).toEqual([A.banani]);
    expect((await avail(B["dhanmondi-27"], s)).map((r) => r.area_id)).toEqual([A.d27]);
  });

  it("a full Banani does not touch Dhanmondi's capacity", async () => {
    const s = dhaka(3, "19:00");
    const b = await book(db, { area: A.banani, start: s, party: 4 });
    await setStatus(db, b.id, "confirmed");
    await hold(db, { area: A.banani, start: s, party: 4 });
    expect((await avail(B.banani, s))[0]).toMatchObject({ remaining: 0, available: false });
    expect((await avail(B["dhanmondi-27"], s))[0]).toMatchObject({ remaining: 8, available: true });
    expect((await hold(db, { area: A.d27, start: s, party: 4 })).hold_id).toBeTruthy();
    await expect(hold(db, { area: A.banani, start: s, party: 1 })).rejects.toThrow(pwError("PW_SLOT_FULL"));
  });

  it("a whole-branch blockout closes that branch only; one with no branch closes every branch", async () => {
    const s = dhaka(4, "12:00");
    await db.q("insert into public.blockouts (area_id, branch_id, starts_at, ends_at, reason) values (null, $1, $2::timestamptz, $2::timestamptz + interval '2 hours', 'Test event')", [B.banani, s]);
    expect((await avail(B.banani, s))[0].available).toBe(false);
    expect((await avail(B["dhanmondi-6"], s)).every((r) => r.available)).toBe(true);

    const s2 = dhaka(4, "18:00");
    await db.q("insert into public.blockouts (area_id, branch_id, starts_at, ends_at, reason) values (null, null, $1::timestamptz, $1::timestamptz + interval '2 hours', 'Test closure')", [s2]);
    for (const branch of Object.values(B)) expect((await avail(branch, s2)).every((r) => !r.available)).toBe(true);
  });

  it("a branch's own hours apply to it alone", async () => {
    const s = dhaka(5, "12:00");
    const weekday = new Date(s).getUTCDay();
    await db.q("insert into public.opening_hours (branch_id, weekday, opens_at, closes_at, is_closed) values ($1, $2, '17:00', '23:00', false)", [B.banani, weekday]);
    await expect(hold(db, { area: A.banani, start: s })).rejects.toThrow(pwError("PW_OUTSIDE_HOURS"));
    expect((await hold(db, { area: A.d6, start: s })).hold_id).toBeTruthy();
    expect((await hold(db, { area: A.banani, start: dhaka(5, "21:00") })).hold_id).toBeTruthy(); // 22:30 end is inside 23:00
    const [sched] = await db.as<{ opens: string }>("anon", "select opens from public.get_schedule(7, $1) where day = $2::date", [B.banani, s.slice(0, 10)]);
    expect(new Date(sched.opens).toISOString()).toBe(new Date(`${s.slice(0, 10)}T17:00:00+06:00`).toISOString());
  });

  it("a switched-off branch offers nothing and takes no holds", async () => {
    await db.q("update public.branches set is_active = false where id = $1", [B["dhanmondi-27"]]);
    const s = dhaka(6, "12:00");
    expect(await avail(B["dhanmondi-27"], s)).toEqual([]);
    await expect(hold(db, { area: A.d27, start: s })).rejects.toThrow(pwError("PW_INVALID_AREA"));
    await db.q("update public.branches set is_active = true where id = $1", [B["dhanmondi-27"]]);
  });

  it("staff lists show each booking's branch (from its area)", async () => {
    const s = dhaka(7, "12:00");
    const b = await book(db, { area: A.banani, start: s, party: 2 });
    const staff = await staffUser(db, "foh");
    const rows = await db.as<{ r: { id: string; branch: { slug: string } } }>("authenticated", "select r from public.admin_list_reservations($1::date, $1::date) r", [s.slice(0, 10)], staff);
    expect(rows.find((x) => x.r.id === b.id)?.r.branch.slug).toBe("banani");
  });

  it("areas without a branch (the old placeholder areas) are never offered for a branch", async () => {
    await db.q("update public.areas set is_active = true where branch_id is null");
    const s = dhaka(8, "12:00");
    const legacy = (await db.q<{ id: string }>("select id from public.areas where branch_id is null")).map((r) => r.id);
    for (const branch of Object.values(B)) {
      expect((await avail(branch, s)).some((r) => legacy.includes(r.area_id))).toBe(false);
    }
    // They still answer a request with no branch, which is why branch_setup.sql step 5 switches them off.
    expect((await avail(null, s)).some((r) => legacy.includes(r.area_id))).toBe(true);
    await db.q("update public.areas set is_active = false where branch_id is null");
  });
});
