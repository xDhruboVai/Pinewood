// Who can do what, enforced by the database (grants, RLS, is_staff/is_manager checks):
// anon = the publishable key in a browser, authenticated = a signed-in user (staff or not),
// service_role = the website's server. Nothing is loosened to make these pass.
import { beforeAll, describe, expect, it } from "vitest";
import { book, branchManagerForArea, dhaka, pwError, setStatus, staffUser, standardFixture, openTestDb } from "./helpers";

const db = openTestDb();
let A: Record<string, string>;
let reservation: string;
let dish: string;
let nobody: string, foh: string, manager: string, owner: string, retired: string;
let branches: Record<string, string>;
const DENIED = /permission denied/;

beforeAll(async () => {
  const fixture = await standardFixture(db);
  A = fixture.areas;
  branches = fixture.branches;
  reservation = (await book(db, { area: A.d6, start: dhaka(3, "12:00") })).id;
  dish = (await db.q<{ id: string }>("select id from public.menu_items order by sort_order limit 1"))[0].id;
  nobody = await staffUser(db, null); // signed in, not staff
  foh = await staffUser(db, "foh");
  manager = await staffUser(db, "manager");
  await db.q("update public.staff_profiles set branch_id = $2 where user_id = $1", [manager, branches["dhanmondi-6"]]);
  owner = await staffUser(db, "owner");
  retired = await staffUser(db, "manager", false);
});

const price = async () => Number((await db.q<{ price: string }>("select price from public.menu_items where id = $1", [dish]))[0].price);
// Server-only functions; $1 is filled with a real id (area or booking) so only permissions can fail.
const bookingCalls: [sql: string, id: () => string][] = [
  ["select * from public.hold_slot($1, now() + interval '2 days', 90, 2, 'k', 'ip')", () => A.d6],
  ["select * from public.create_reservation($1, 'k', 'Name', '+8801711111111', 'a@b.cd', '', false, 'en')", () => reservation],
  ["select public.upsert_pre_order($1, '[]'::jsonb, '')", () => reservation],
  ["select public.request_cancellation($1)", () => reservation],
  ["select public.run_housekeeping() where $1::text is not null", () => ""],
  ["select public.dispatch_email(1) where $1::text is not null", () => ""],
  ["select public.promote_waitlist($1, now(), now() + interval '1 hour')", () => A.d6],
];

describe("publishable key (anon)", () => {
  it("can read public data and the availability grid", async () => {
    expect((await db.as("anon", "select count(*)::int n from public.menu_items"))[0].n).toBeGreaterThan(0);
    expect(await db.as("anon", "select * from public.get_availability(current_date + 2, 2, 90, null) limit 1")).toBeDefined();
    expect(await db.as("anon", "select * from public.get_schedule(7, null)")).toHaveLength(7);
  });
  it("cannot call any booking mutation or background job", async () => {
    for (const [sql, id] of bookingCalls) await expect(db.as("anon", sql, [id()]), sql).rejects.toThrow(DENIED);
  });
  it("cannot read bookings, guests, pre-orders, the waitlist or the email log", async () => {
    for (const t of ["reservations", "pre_orders", "waitlist_entries", "email_log", "slot_holds", "staff_profiles", "blockouts", "dining_tables"]) {
      expect(await db.as("anon", `select * from public.${t}`), t).toEqual([]);
    }
  });
  it("cannot change the menu or write a booking directly", async () => {
    await db.as("anon", "update public.menu_items set price = 1 where id = $1", [dish]);
    expect(await price()).not.toBe(1);
    await expect(
      db.as("anon", "insert into public.reservations (area_id, starts_at, ends_at, party_size, customer_name, phone, email) values ($1, now() + interval '1 day', now() + interval '1 day 1 hour', 2, 'X Y', '+8801711111111', 'a@b.cd')", [A.d6]),
    ).rejects.toThrow(/row-level security|permission denied/); // refused either way; nothing is written
    expect(await db.q("select 1 from public.reservations where customer_name = 'X Y'")).toEqual([]);
  });
  it("cannot use the staff functions", async () => {
    await expect(db.as("anon", "select * from public.admin_list_reservations(current_date, current_date)")).rejects.toThrow(DENIED);
    await expect(db.as("anon", "select public.admin_set_status($1, 'confirmed', null)", [reservation])).rejects.toThrow(DENIED);
  });
});

describe("signed in but not staff", () => {
  it("is refused by every staff function and sees no bookings", async () => {
    for (const sql of [
      "select * from public.admin_list_reservations(current_date, current_date + 7)",
      "select * from public.admin_list_pre_orders(current_date, current_date)",
      `select public.admin_set_status('${reservation}', 'confirmed', null)`,
      `select public.admin_resend_email('${reservation}')`,
    ]) {
      await expect(db.as("authenticated", sql, [], nobody), sql).rejects.toThrow(/PW_FORBIDDEN/);
    }
    expect(await db.as("authenticated", "select * from public.reservations", [], nobody)).toEqual([]);
    for (const [sql, id] of bookingCalls) await expect(db.as("authenticated", sql, [id()], nobody), sql).rejects.toThrow(DENIED);
  });
  it("a deactivated staff account counts as not staff", async () => {
    await expect(db.as("authenticated", "select * from public.admin_list_reservations(current_date, current_date)", [], retired)).rejects.toThrow(/PW_FORBIDDEN/);
  });
});

describe("front of house (foh)", () => {
  it("can list and manage bookings", async () => {
    const day = dhaka(3, "12:00").slice(0, 10);
    const rows = await db.as<{ r: { id: string } }>("authenticated", "select r from public.admin_list_reservations($1::date, $1::date) r", [day], foh);
    expect(rows.map((x) => x.r.id)).toContain(reservation);
    await db.as("authenticated", "select public.admin_set_status($1, 'confirmed', null)", [reservation], foh);
    expect((await db.q("select status from public.reservations where id = $1", [reservation]))[0].status).toBe("confirmed");
  });
  it("cannot change menu prices, areas, tables or hours (manager only)", async () => {
    const before = await price();
    await db.as("authenticated", "update public.menu_items set price = 1 where id = $1", [dish], foh);
    await db.as("authenticated", "update public.areas set is_active = false where id = $1", [A.d6], foh);
    await db.as("authenticated", "update public.opening_hours set is_closed = true", [], foh);
    expect(await price()).toBe(before);
    expect((await db.q("select is_active from public.areas where id = $1", [A.d6]))[0].is_active).toBe(true);
    expect((await db.q("select count(*)::int n from public.opening_hours where is_closed"))[0].n).toBe(0);
  });
  it("sees only their own staff profile", async () => {
    const rows = await db.as<{ user_id: string }>("authenticated", "select user_id from public.staff_profiles", [], foh);
    expect(rows.map((r) => r.user_id)).toEqual([foh]);
  });
  it("can read the dining tables (a signed-in non-staff user cannot)", async () => {
    expect((await db.as<{ n: number }>("authenticated", "select count(*)::int n from public.dining_tables", [], foh))[0].n).toBeGreaterThan(0);
    expect(await db.as("authenticated", "select * from public.dining_tables", [], nobody)).toEqual([]);
  });
  it("can change a waitlist entry's status, but not the guest's details", async () => {
    const [w] = await db.q<{ id: string }>(
      "insert into public.waitlist_entries (area_id, starts_at, ends_at, party_size, customer_name, phone, email) values ($1, now() + interval '3 days', now() + interval '3 days 90 minutes', 2, 'Wait Test', '+8801788000077', 'wt@test.local') returning id",
      [A.d6],
    );
    await db.as("authenticated", "update public.waitlist_entries set status = 'cancelled' where id = $1", [w.id], foh);
    expect((await db.q("select status from public.waitlist_entries where id = $1", [w.id]))[0].status).toBe("cancelled");
    await expect(db.as("authenticated", "update public.waitlist_entries set phone = '+8801700000000' where id = $1", [w.id], foh)).rejects.toThrow(DENIED);
  });
});

describe("manager", () => {
  it("cannot change global menu values and sees every staff profile", async () => {
    const before = await price();
    await db.as("authenticated", "update public.menu_items set price = 777 where id = $1", [dish], manager);
    expect(await price()).toBe(before);
    expect((await db.as("authenticated", "select user_id from public.staff_profiles", [], manager)).length).toBeGreaterThanOrEqual(3);
  });
  it("can override menu values only for the assigned branch", async () => {
    await db.q("update public.staff_profiles set branch_id = $2 where user_id = $1", [manager, branches.banani]);
    await expect(
      db.as(
        "authenticated",
        "select public.admin_set_branch_menu_item($1, $2, true, 444, false, null)",
        [branches.d6, dish],
        manager,
      ),
    ).rejects.toThrow(pwError("PW_FORBIDDEN"));
    await db.as(
      "authenticated",
      "select public.admin_set_branch_menu_item($1, $2, true, 444, true, false)",
      [branches.banani, dish],
      manager,
    );
    expect((await db.q("select price, is_available from public.menu_item_branch_overrides where menu_item_id = $1 and branch_id = $2", [dish, branches.banani]))[0]).toMatchObject({
      price: "444.00",
      is_available: false,
    });
    expect(await price()).not.toBe(444);
  });
  it("can change front-of-house access but cannot directly edit or appoint managers", async () => {
    const other = await staffUser(db, "foh");
    await expect(db.as("authenticated", "update public.staff_profiles set role = 'manager' where user_id = $1", [other], manager)).rejects.toThrow(DENIED);
    await expect(
      db.as("authenticated", "select public.admin_update_staff($1, 'manager'::public.staff_role, null, null, false)", [other], manager),
    ).rejects.toThrow(pwError("PW_FORBIDDEN"));
    await db.as("authenticated", "select public.admin_update_staff($1, null, false, null, false)", [other], manager);
    expect((await db.q("select is_active from public.staff_profiles where user_id = $1", [other]))[0].is_active).toBe(false);
    await db.as("authenticated", "update public.staff_profiles set is_active = false where user_id = $1", [manager], manager);
    expect((await db.q("select is_active from public.staff_profiles where user_id = $1", [manager]))[0].is_active).toBe(true);
  });
  it("lets owners appoint managers to branches and remove the appointment", async () => {
    const other = await staffUser(db, "foh");
    await db.as(
      "authenticated",
      "select public.admin_update_staff($1, 'manager'::public.staff_role, null, $2, true)",
      [other, branches.banani],
      owner,
    );
    expect((await db.q("select role, branch_id from public.staff_profiles where user_id = $1", [other]))[0]).toMatchObject({
      role: "manager",
      branch_id: branches.banani,
    });
    await db.as(
      "authenticated",
      "select public.admin_update_staff($1, 'foh'::public.staff_role, null, null, true)",
      [other],
      owner,
    );
    expect((await db.q("select role, branch_id from public.staff_profiles where user_id = $1", [other]))[0]).toMatchObject({
      role: "foh",
      branch_id: null,
    });
  });
  it("still cannot call the server-only booking functions directly", async () => {
    for (const [sql, id] of bookingCalls) await expect(db.as("authenticated", sql, [id()], manager), sql).rejects.toThrow(DENIED);
  });
});

describe("owner", () => {
  it("can change the global menu default while branch overrides remain separate", async () => {
    const branchManager = await staffUser(db, "manager");
    await db.q("update public.staff_profiles set branch_id = $2 where user_id = $1", [branchManager, branches.banani]);
    await db.as(
      "authenticated",
      "select public.admin_set_branch_menu_item($1, $2, true, 444, false, null)",
      [branches.banani, dish],
      branchManager,
    );
    await db.as("authenticated", "update public.menu_items set price = 777 where id = $1", [dish], owner);
    expect(await price()).toBe(777);
    expect((await db.q("select price from public.menu_item_branch_overrides where menu_item_id = $1 and branch_id = $2", [dish, branches.banani]))[0].price).toBe("444.00");
  });
});

describe("branch staff directory", () => {
  it("lets a manager add, update and deactivate records only in their own branch", async () => {
    const branchManager = await staffUser(db, "manager");
    await db.q("update public.staff_profiles set branch_id = $2 where user_id = $1", [branchManager, branches.banani]);
    const [created] = await db.as<{ id: string }>(
      "authenticated",
      "select public.manager_upsert_branch_staff(null, $1, 'Rafi Ahmed', 'Side chef', null, '01700000000', 'Evening prep', true) as id",
      [branches.banani],
      branchManager,
    );
    expect((await db.q("select full_name, job_title, is_active from public.branch_staff where id = $1", [created.id]))[0]).toMatchObject({
      full_name: "Rafi Ahmed",
      job_title: "Side chef",
      is_active: true,
    });

    await expect(
      db.as(
        "authenticated",
        "select public.manager_upsert_branch_staff($1, $2, 'Rafi Ahmed', 'Waiter', null, null, null, true)",
        [created.id, branches["dhanmondi-6"]],
        branchManager,
      ),
    ).rejects.toThrow(pwError("PW_FORBIDDEN"));

    await db.as(
      "authenticated",
      "select public.manager_upsert_branch_staff($1, $2, 'Rafi Ahmed', 'Side chef', null, null, null, false)",
      [created.id, branches.banani],
      branchManager,
    );
    expect((await db.q("select is_active from public.branch_staff where id = $1", [created.id]))[0].is_active).toBe(false);
    await expect(
      db.as("authenticated", "insert into public.branch_staff (branch_id, full_name, job_title) values ($1, 'Direct Write', 'Waiter')", [branches.banani], branchManager),
    ).rejects.toThrow(DENIED);
  });

  it("lets an owner manage staff records for any branch", async () => {
    const [created] = await db.as<{ id: string }>(
      "authenticated",
      "select public.manager_upsert_branch_staff(null, $1, 'Nadia Rahman', 'Waiter', 'nadia@example.test', null, null, true) as id",
      [branches["dhanmondi-6"]],
      owner,
    );
    expect((await db.q("select branch_id, job_title from public.branch_staff where id = $1", [created.id]))[0]).toMatchObject({
      branch_id: branches["dhanmondi-6"],
      job_title: "Waiter",
    });
  });
});

describe("manager history", () => {
  it("records the appointment branch and removal when an owner revokes manager access", async () => {
    const account = await staffUser(db, null);
    await db.q(
      "insert into public.staff_profiles (user_id, full_name, role, branch_id, is_active) values ($1, 'Test Manager', 'manager', $2, true)",
      [account, branches.banani],
    );
    await db.as(
      "authenticated",
      "select public.admin_update_staff($1, 'foh'::public.staff_role, false, null, true)",
      [account],
      owner,
    );

    const rows = await db.q<{ event: string; full_name: string; branch_name: string; actor_user_id: string | null }>(
      "select event, full_name, branch_name, actor_user_id from public.manager_history where staff_user_id = $1 order by id",
      [account],
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.event)).toEqual(["appointed", "removed"]);
    expect(rows.map((row) => row.branch_name)).toEqual(["Banani", "Banani"]);
    expect(rows.every((row) => row.full_name === "Test Manager")).toBe(true);
    expect(rows[1].actor_user_id).toBe(owner);
  });
});

describe("deleting a booking", () => {
  const del = (id: string, user: string) => db.as("authenticated", "select public.admin_delete_reservation($1)", [id], user);
  const exists = async (id: string) => (await db.q("select 1 from public.reservations where id = $1", [id])).length === 1;

  it("only a manager can, and only once the booking is over", async () => {
    const live = (await book(db, { area: A.d6, start: dhaka(5, "13:00") })).id;
    const d6Manager = await branchManagerForArea(db, A.d6);
    await expect(del(live, d6Manager)).rejects.toThrow(pwError("PW_NOT_DELETABLE")); // pending
    await setStatus(db, live, "confirmed");
    await expect(del(live, d6Manager)).rejects.toThrow(pwError("PW_NOT_DELETABLE"));
    await setStatus(db, live, "cancelled");
    await expect(del(live, foh)).rejects.toThrow(pwError("PW_FORBIDDEN"));
    await expect(del(live, nobody)).rejects.toThrow(pwError("PW_FORBIDDEN"));
    await expect(db.as("anon", "select public.admin_delete_reservation($1)", [live])).rejects.toThrow(DENIED);
    expect(await exists(live)).toBe(true);
    await del(live, d6Manager);
    expect(await exists(live)).toBe(false);
    await expect(del(live, d6Manager)).rejects.toThrow(pwError("PW_NOT_FOUND"));
  });
  it("takes the booking's email log and tables with it", async () => {
    const r = (await book(db, { area: A.d6, start: dhaka(6, "13:00") })).id;
    const d6Manager = await branchManagerForArea(db, A.d6);
    await setStatus(db, r, "rejected");
    expect((await db.q("select 1 from public.email_log where reservation_id = $1", [r])).length).toBeGreaterThan(0);
    await del(r, d6Manager);
    expect(await db.q("select 1 from public.email_log where reservation_id = $1", [r])).toEqual([]);
    expect(await db.q("select 1 from public.reservation_tables where reservation_id = $1", [r])).toEqual([]);
  });
});

describe("server (service_role)", () => {
  it("is the only role that can run the booking functions", async () => {
    const [h] = await db.as<{ hold_id: string }>("service_role", "select * from public.hold_slot($1, $2, 90, 2, 'server', 'ip-server')", [A.d6, dhaka(4, "12:00")]);
    expect(h.hold_id).toBeTruthy();
  });
});
