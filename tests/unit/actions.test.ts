// Server actions: what reaches the database and what the browser gets back. Supabase and Next's
// request APIs are mocked, so these tests show the validation and authorisation done in the action;
// the database's own checks are tested in tests/db.
import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  rpc: vi.fn(),
  rows: {} as Record<string, unknown>,
  calls: [] as { table: string; op: string; args: unknown[] }[],
}));
const authAdmin = vi.hoisted(() => ({ inviteUserByEmail: vi.fn(), createUser: vi.fn() }));
const jar = vi.hoisted(() => new Map<string, string>());
const staff = vi.hoisted(() => ({ current: null as null | { userId: string; email: string; fullName: string; role: "owner" | "manager" | "foh"; branchId?: string | null } }));
const cache = vi.hoisted(() => ({ updateTag: vi.fn(), revalidateTag: vi.fn(), revalidatePath: vi.fn() }));

// A chainable stand-in for the Supabase query builder: records every call, resolves to db.rows[table].
function table(name: string) {
  const result = () => ({ data: db.rows[name] ?? null, error: null });
  const chain: Record<string, unknown> = {};
  for (const op of ["select", "eq", "is", "in", "order", "update", "insert", "delete", "upsert"]) {
    chain[op] = (...args: unknown[]) => {
      db.calls.push({ table: name, op, args });
      return chain;
    };
  }
  chain.maybeSingle = async () => result();
  chain.single = async () => result();
  chain.then = (resolve: (v: unknown) => unknown) => resolve(result());
  return chain;
}
const client = {
  auth: { admin: {
    inviteUserByEmail: (...args: unknown[]) => authAdmin.inviteUserByEmail(...args),
    createUser: (...args: unknown[]) => authAdmin.createUser(...args),
  } },
  rpc: (...a: unknown[]) => db.rpc(...a),
  from: (t: string) => table(t),
};

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => client,
  createClient: async () => client,
  createPublicClient: () => client,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined), set: (k: string, v: string) => jar.set(k, v) }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
}));
vi.mock("next/cache", () => cache);
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getStaff: async () => staff.current }));

const { holdSlot, submitReservation } = await import("@/actions/reservation");
const { savePreOrder, requestCancellation } = await import("@/actions/preorder");
const admin = await import("@/actions/admin");

const AREA = "3f1c2b4a-9d8e-4f7a-b6c5-1a2b3c4d5e6f";
const HOLD = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const ITEM = "11111111-2222-4333-8444-555555555555";
const SECRET = "test-reservation-secret-that-is-long-enough";

beforeEach(() => {
  db.rpc.mockReset();
  db.rows = {};
  db.calls = [];
  jar.clear();
  staff.current = null;
  cache.updateTag.mockReset();
  authAdmin.inviteUserByEmail.mockReset();
  authAdmin.createUser.mockReset();
  process.env.RESERVATION_TOKEN_SECRET = SECRET;
});

describe("holdSlot", () => {
  const slot = { areaId: AREA, start: "2026-10-02T19:30:00+06:00", duration: 90, partySize: 4 };

  it("refuses a malformed slot without calling the database", async () => {
    expect(await holdSlot({ ...slot, partySize: 11 })).toEqual({ ok: false, error: "PW_INVALID_SLOT" });
    expect(await holdSlot({ ...slot, start: "tomorrow" })).toEqual({ ok: false, error: "PW_INVALID_SLOT" });
    expect(await holdSlot("not an object")).toEqual({ ok: false, error: "PW_INVALID_SLOT" });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("holds through hold_slot with a browser key cookie and a hashed (never raw) network address", async () => {
    db.rpc.mockResolvedValue({ data: [{ hold_id: HOLD, expires_at: "2026-10-02T13:40:00Z" }], error: null });
    expect(await holdSlot(slot)).toEqual({ ok: true, data: { holdId: HOLD, expiresAt: "2026-10-02T13:40:00Z" } });
    const [name, args] = db.rpc.mock.calls[0];
    expect(name).toBe("hold_slot");
    expect(args).toMatchObject({ p_area: AREA, p_start: slot.start, p_duration_minutes: 90, p_party_size: 4 });
    expect(args.p_client_key).toBe(jar.get("pw-bid"));
    expect(args.p_client_key).toMatch(/^[0-9a-f-]{36}$/);
    expect(args.p_ip_hash).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(args)).not.toContain("203.0.113.7");
  });

  it("keeps the same browser key across holds", async () => {
    db.rpc.mockResolvedValue({ data: [{ hold_id: HOLD, expires_at: "x" }], error: null });
    await holdSlot(slot);
    await holdSlot(slot);
    expect(db.rpc.mock.calls[0][1].p_client_key).toBe(db.rpc.mock.calls[1][1].p_client_key);
  });

  it("turns a database refusal into its PW_ code only", async () => {
    db.rpc.mockResolvedValue({ data: null, error: { message: "PW_SLOT_FULL" } });
    expect(await holdSlot(slot)).toEqual({ ok: false, error: "PW_SLOT_FULL" });
    db.rpc.mockResolvedValue({ data: null, error: { message: 'relation "x" does not exist' } });
    expect(await holdSlot(slot)).toEqual({ ok: false, error: "generic" });
  });
});

describe("submitReservation", () => {
  const form = { name: "Nadia Rahman", phone: "017 1234 5678", email: "nadia@example.com", requests: "Branch: Banani", consent: true, holdId: HOLD, locale: "bn" };

  it("returns field errors and does not call the database for bad details", async () => {
    const r = await submitReservation({ ...form, name: "N", phone: "123", email: "x" });
    expect(r).toMatchObject({ ok: false, fields: { name: "invalidName", phone: "invalidPhone", email: "invalidEmail" } });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("refuses notes over 500 characters", async () => {
    expect((await submitReservation({ ...form, requests: "x".repeat(501) })).ok).toBe(false);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("creates the booking with the normalised phone and returns the reference", async () => {
    db.rpc.mockResolvedValue({ data: [{ reservation_id: AREA, reference: "PW-ABC234" }], error: null });
    expect(await submitReservation(form)).toEqual({ ok: true, data: { reference: "PW-ABC234", phone: "+8801712345678" } });
    expect(db.rpc).toHaveBeenCalledWith("create_reservation", expect.objectContaining({ p_hold_id: HOLD, p_phone: "+8801712345678", p_locale: "bn" }));
  });

  it("refuses a filled honeypot (a bot) and never books", async () => {
    const bot = await submitReservation({ ...form, website: "http://spam.example" });
    expect(bot.ok).toBe(false);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("maps database refusals such as PW_TOO_MANY_ACTIVE", async () => {
    db.rpc.mockResolvedValue({ data: null, error: { message: "PW_TOO_MANY_ACTIVE" } });
    expect(await submitReservation(form)).toEqual({ ok: false, error: "PW_TOO_MANY_ACTIVE" });
  });
});

describe("guest link actions (pre-order, cancellation request)", () => {
  const token = (ver = 1, secret = SECRET) =>
    new SignJWT({ ver }).setProtectedHeader({ alg: "HS256" }).setSubject(AREA).setAudience("pinewood:reservation").setExpirationTime("1h").sign(new TextEncoder().encode(secret));

  it("refuses an invalid, forged or outdated link without touching the booking", async () => {
    db.rows.reservations = { id: AREA, token_version: 2 };
    for (const t of ["x".repeat(30), await token(1, "another-secret-another-secret-xx"), await token(1)]) {
      expect(await savePreOrder({ token: t, items: [{ item_id: ITEM, quantity: 1 }] })).toEqual({ ok: false, error: "invalidLink" });
      expect(await requestCancellation(t)).toEqual({ ok: false, error: "invalidLink" });
    }
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("never forwards a browser price: only item, variant, add-ons, quantity and note reach upsert_pre_order", async () => {
    db.rows.reservations = { id: AREA, token_version: 2 };
    db.rows.pre_orders = { total: 1580 };
    db.rpc.mockResolvedValue({ data: "po-1", error: null });
    const r = await savePreOrder({ token: await token(2), items: [{ item_id: ITEM, quantity: 2, price: 1, unit_price: 1, line_total: 2, total: 2 }] });
    expect(r).toEqual({ ok: true, data: { total: 1580 } });
    const [, args] = db.rpc.mock.calls[0];
    expect(args.p_items).toEqual([{ item_id: ITEM, variant_id: null, addon_ids: [], quantity: 2, notes: "" }]);
  });

  it("refuses out-of-range quantities before the database", async () => {
    db.rows.reservations = { id: AREA, token_version: 1 };
    expect(await savePreOrder({ token: await token(1), items: [{ item_id: ITEM, quantity: 21 }] })).toEqual({ ok: false, error: "PW_INVALID_ITEMS" });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("passes the database's pre-order refusals through as codes", async () => {
    db.rows.reservations = { id: AREA, token_version: 1 };
    db.rpc.mockResolvedValue({ data: null, error: { message: "PW_PREORDER_CUTOFF" } });
    expect(await savePreOrder({ token: await token(1), items: [{ item_id: ITEM, quantity: 1 }] })).toEqual({ ok: false, error: "PW_PREORDER_CUTOFF" });
  });
});

describe("admin actions: authorisation and validation", () => {
  const foh = { userId: "u1", email: "f@x", fullName: "F", role: "foh" as const };
  const manager = { ...foh, role: "manager" as const, branchId: "33333333-3333-4333-8333-333333333333" };
  const owner = { ...foh, role: "owner" as const };

  it("tells a signed-out user their session ended, for every action, without touching the database", async () => {
    const calls = [
      admin.setReservationStatus(AREA, "confirmed"),
      admin.resendEmail(AREA),
      admin.setPreOrderStatus(AREA, "ready"),
      admin.setWaitlistStatus(AREA, "cancelled"),
      admin.updateMenuItem(ITEM, { price: 500 }),
      admin.toggleArea(AREA, false),
      admin.createHoursOverride({}),
      admin.inviteStaff({}),
    ];
    for (const r of await Promise.all(calls)) expect(r).toEqual({ ok: false, error: "Your session has ended. Please sign in again." });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db.calls).toEqual([]);
  });

  it("keeps manager-only actions from front-of-house staff", async () => {
    staff.current = foh;
    for (const r of await Promise.all([admin.updateMenuItem(ITEM, { price: 500 }), admin.toggleArea(AREA, false), admin.updateOpeningHours(1, "10:00", "22:00", false), admin.inviteStaff({})])) {
      expect(r).toEqual({ ok: false, error: "Only managers can do that." });
    }
    expect(db.calls).toEqual([]);
  });

  it("creates a manager account with the supplied temporary password", async () => {
    staff.current = owner;
    authAdmin.createUser.mockResolvedValue({ data: { user: { id: "22222222-2222-4222-8222-222222222222" } }, error: null });
    const result = await admin.inviteStaff({
      fullName: "Dihan Islam",
      email: "manager@example.com",
      role: "manager",
      branchId: "33333333-3333-4333-8333-333333333333",
      temporaryPassword: "temp-pass-123",
    });
    expect(result).toEqual({ ok: true, data: undefined });
    expect(authAdmin.createUser).toHaveBeenCalledWith({
      email: "manager@example.com",
      password: "temp-pass-123",
      email_confirm: true,
      user_metadata: { full_name: "Dihan Islam" },
    });
    expect(db.calls.find((call) => call.table === "staff_profiles")?.args[0]).toMatchObject({
      role: "manager",
      branch_id: "33333333-3333-4333-8333-333333333333",
    });
    expect(authAdmin.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("requires a temporary password before creating a manager account", async () => {
    staff.current = owner;
    const details = {
      fullName: "Dihan Islam",
      email: "manager@example.com",
      role: "manager",
      branchId: "33333333-3333-4333-8333-333333333333",
    };
    expect(await admin.inviteStaff(details)).toEqual({ ok: false, error: "Enter a temporary password for this manager." });
    expect(await admin.inviteStaff({ ...details, temporaryPassword: "short" })).toEqual({
      ok: false,
      error: "Temporary password must be between 8 and 72 characters.",
    });
    expect(authAdmin.createUser).not.toHaveBeenCalled();
  });

  it("lets front-of-house staff change a booking's status", async () => {
    staff.current = foh;
    db.rpc.mockResolvedValue({ data: null, error: null });
    expect(await admin.setReservationStatus(AREA, "confirmed")).toEqual({ ok: true, data: undefined });
    expect(db.rpc).toHaveBeenCalledWith("admin_set_status", { p_id: AREA, p_status: "confirmed", p_reason: null });
  });

  it("refuses a malformed booking id or an unknown status", async () => {
    staff.current = manager;
    expect(await admin.setReservationStatus("1; drop table", "confirmed")).toEqual({ ok: false, error: "Invalid request" });
    expect(await admin.setReservationStatus(AREA, "deleted" as never)).toEqual({ ok: false, error: "Invalid request" });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("shows friendly text for database refusals, never the raw message", async () => {
    staff.current = manager;
    db.rpc.mockResolvedValue({ data: null, error: { message: "PW_INVALID_TRANSITION" } });
    expect(await admin.setReservationStatus(AREA, "seated")).toEqual({ ok: false, error: "That status change isn't allowed from the current status." });
  });

  it("never shows staff a raw database error", async () => {
    staff.current = manager;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    db.rpc.mockResolvedValue({ data: null, error: { message: 'relation "reservations" does not exist' } });
    expect(await admin.setReservationStatus(AREA, "confirmed")).toEqual({ ok: false, error: "Something went wrong. Please try again." });
    expect(log).toHaveBeenCalled(); // the detail goes to the server log
    log.mockRestore();
  });

  it.each([0, -5, 100001, 12.345, Number.NaN, Number.POSITIVE_INFINITY, "500" as unknown as number])("refuses price %s without saving", async (price) => {
    staff.current = owner;
    expect(await admin.updateMenuItem(ITEM, { price })).toEqual({ ok: false, error: "Enter a price above ৳0 (up to ৳100,000, at most 2 decimals)." });
    expect(db.calls).toEqual([]);
  });

  it("saves a valid price and invalidates the public menu cache", async () => {
    staff.current = owner;
    expect(await admin.updateMenuItem(ITEM, { price: 12.3 })).toEqual({ ok: true, data: undefined });
    expect(db.calls.find((c) => c.op === "update")?.args[0]).toEqual({ price: 12.3 });
    expect(cache.updateTag).toHaveBeenCalledWith("menu");
  });

  it("blocks managers from changing global menu defaults", async () => {
    staff.current = manager;
    expect(await admin.updateMenuItem(ITEM, { price: 500 })).toEqual({ ok: false, error: "Only owners can change the global menu." });
    expect(db.calls).toEqual([]);
  });

  it("writes a manager edit only through their assigned branch", async () => {
    staff.current = manager;
    db.rpc.mockResolvedValue({ data: null, error: null });
    expect(await admin.updateBranchMenuItem(ITEM, { price: 700, is_available: false })).toEqual({ ok: true, data: undefined });
    expect(db.rpc).toHaveBeenCalledWith("admin_set_branch_menu_item", {
      p_branch_id: manager.branchId,
      p_item_id: ITEM,
      p_set_price: true,
      p_price: 700,
      p_set_availability: true,
      p_is_available: false,
    });
    expect(cache.updateTag).toHaveBeenCalledWith("menu");
  });

  it("binds staff-directory writes to the signed-in manager branch", async () => {
    staff.current = manager;
    db.rpc.mockResolvedValue({ data: "44444444-4444-4444-8444-444444444444", error: null });
    const result = await admin.saveBranchStaff({
      fullName: "Rafi Ahmed",
      jobTitle: "Side chef",
      email: "",
      phone: "",
      notes: "Evening shift",
      isActive: true,
      branchId: "55555555-5555-4555-8555-555555555555",
    });
    expect(result).toEqual({ ok: true, data: { id: "44444444-4444-4444-8444-444444444444" } });
    expect(db.rpc).toHaveBeenCalledWith("manager_upsert_branch_staff", expect.objectContaining({
      p_branch_id: manager.branchId,
      p_job_title: "Side chef",
    }));
  });

  it("does not allow a manager to appoint managers or assign branches", async () => {
    staff.current = manager;
    expect(await admin.updateStaffMember("22222222-2222-4222-8222-222222222222", { role: "manager", branch_id: "33333333-3333-4333-8333-333333333333" })).toEqual({
      ok: false,
      error: "Only owners can change managerial roles or branch assignments.",
    });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("lets an owner update another staff member through the guarded database function", async () => {
    staff.current = { ...manager, role: "owner" };
    db.rpc.mockResolvedValue({ data: null, error: null });
    expect(await admin.updateStaffMember("22222222-2222-4222-8222-222222222222", { role: "manager", branch_id: "33333333-3333-4333-8333-333333333333" })).toEqual({ ok: true, data: undefined });
    expect(db.rpc).toHaveBeenCalledWith("admin_update_staff", expect.objectContaining({
      p_role: "manager",
      p_branch_id: "33333333-3333-4333-8333-333333333333",
      p_set_branch: true,
    }));
  });

  it("sends front-of-house invitations to the shared login", async () => {
    staff.current = owner;
    authAdmin.inviteUserByEmail.mockResolvedValue({ data: { user: { id: "66666666-6666-4666-8666-666666666666" } }, error: null });
    const result = await admin.inviteStaff({
      email: "manager@example.test",
      fullName: "Branch Manager",
      role: "foh",
      branchId: null,
    });
    expect(result).toEqual({ ok: true, data: undefined });
    expect(authAdmin.inviteUserByEmail).toHaveBeenCalledWith("manager@example.test", expect.objectContaining({
      redirectTo: expect.stringMatching(/\/admin\?invited=1$/),
    }));
  });

  it("ignores unknown fields in a menu update and refuses an empty one", async () => {
    staff.current = owner;
    expect(await admin.updateMenuItem(ITEM, { name_en: "Free food" } as never)).toEqual({ ok: false, error: "Nothing to update." });
    expect(db.calls).toEqual([]);
  });

  it("does not let a manager change their own role or access", async () => {
    staff.current = manager;
    expect(await admin.updateStaffMember("u1", { role: "foh" })).toEqual({ ok: false, error: "You can't change your own role or access." });
  });
});
