// Server-side input rules the booking and pre-order actions apply before touching the database
// (src/lib/validation.ts). The database checks again; see tests/db.
import { describe, expect, it } from "vitest";
import { errorKey, preOrderSchema, reservationSchema, slotSchema } from "@/lib/validation";

const HOLD = "3f1c2b4a-9d8e-4f7a-b6c5-1a2b3c4d5e6f";
const guest = { name: "Nadia Rahman", phone: "01712345678", email: "Nadia@Example.com", consent: true, holdId: HOLD };
const fieldOf = (r: ReturnType<typeof reservationSchema.safeParse>) =>
  r.success ? [] : r.error.issues.map((i) => `${String(i.path[0])}:${i.message}`);

describe("slot (date, time, party)", () => {
  const slot = { areaId: HOLD, start: "2026-10-02T19:30:00+06:00", duration: 90, partySize: 2 };

  it("accepts a normal slot", () => expect(slotSchema.safeParse(slot).success).toBe(true));
  it.each([1, 10])("accepts party size %i", (partySize) => expect(slotSchema.safeParse({ ...slot, partySize }).success).toBe(true));
  it.each([0, 11, -1, 2.5])("rejects party size %s", (partySize) => expect(slotSchema.safeParse({ ...slot, partySize }).success).toBe(false));
  it.each([60, 90, 120, 180, 240])("accepts duration %i", (duration) => expect(slotSchema.safeParse({ ...slot, duration }).success).toBe(true));
  it.each([0, 30, 45, 100, 300])("rejects duration %i", (duration) => expect(slotSchema.safeParse({ ...slot, duration }).success).toBe(false));
  it.each(["not-a-date", "2026-13-40T19:30:00+06:00", "2026-10-02 19:30", "2026-10-02T19:30:00"])("rejects start %s", (start) =>
    expect(slotSchema.safeParse({ ...slot, start }).success).toBe(false),
  );
  it("rejects an area that is not a uuid", () => expect(slotSchema.safeParse({ ...slot, areaId: "fireplace" }).success).toBe(false));
});

describe("guest details", () => {
  it("accepts valid details and normalises them", () => {
    const r = reservationSchema.safeParse(guest);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.phone).toBe("+8801712345678");
    expect(r.data.email).toBe("nadia@example.com");
    expect(r.data.requests).toBe("");
    expect(r.data.locale).toBe("en");
  });

  it.each([
    ["A", "name:invalidName"],
    [" A ", "name:invalidName"],
    ["x".repeat(81), "name:invalidName"],
  ])("rejects name %j", (name, issue) => expect(fieldOf(reservationSchema.safeParse({ ...guest, name }))).toContain(issue));
  it.each(["Al", "x".repeat(80)])("accepts name of length %#", (name) => expect(reservationSchema.safeParse({ ...guest, name }).success).toBe(true));

  it.each(["12345", "0171234567", "02-9876543", "+880", "abc", ""])("rejects phone %j", (phone) =>
    expect(fieldOf(reservationSchema.safeParse({ ...guest, phone }))).toContain("phone:invalidPhone"),
  );

  it.each(["nadia", "nadia@", "@example.com", "nadia@example", `${"a".repeat(250)}@x.com`])("rejects email %j", (email) =>
    expect(fieldOf(reservationSchema.safeParse({ ...guest, email }))).toContain("email:invalidEmail"),
  );

  it("notes: empty, 500 characters and 501 characters", () => {
    expect(reservationSchema.safeParse({ ...guest, requests: "" }).success).toBe(true);
    expect(reservationSchema.safeParse({ ...guest, requests: "Window seat please" }).success).toBe(true);
    expect(reservationSchema.safeParse({ ...guest, requests: "x".repeat(500) }).success).toBe(true);
    expect(reservationSchema.safeParse({ ...guest, requests: "x".repeat(501) }).success).toBe(false);
  });

  it("requires consent and a real hold id", () => {
    expect(fieldOf(reservationSchema.safeParse({ ...guest, consent: false }))).toContain("consent:consentRequired");
    expect(reservationSchema.safeParse({ ...guest, holdId: "not-a-uuid" }).success).toBe(false);
  });

  it("only accepts the two site languages", () => {
    expect(reservationSchema.safeParse({ ...guest, locale: "bn" }).success).toBe(true);
    expect(reservationSchema.safeParse({ ...guest, locale: "fr" }).success).toBe(false);
  });

  it("the honeypot field must stay empty for a real submission", () => {
    expect(reservationSchema.safeParse({ ...guest, website: "" }).success).toBe(true);
    expect(reservationSchema.safeParse({ ...guest, website: "http://spam" }).success).toBe(false);
  });
});

describe("pre-order input", () => {
  const item = { item_id: HOLD, quantity: 1 };
  const order = (items: unknown[], extra = {}) => preOrderSchema.safeParse({ token: "x".repeat(20), items, ...extra });

  it.each([1, 20])("accepts quantity %i", (quantity) => expect(order([{ ...item, quantity }]).success).toBe(true));
  it.each([0, 21, 1.5, -2])("rejects quantity %s", (quantity) => expect(order([{ ...item, quantity }]).success).toBe(false));
  it("accepts 40 lines, rejects 41", () => {
    expect(order(Array(40).fill(item)).success).toBe(true);
    expect(order(Array(41).fill(item)).success).toBe(false);
  });
  it("rejects more than 10 add-ons and non-uuid ids", () => {
    expect(order([{ ...item, addon_ids: Array(11).fill(HOLD) }]).success).toBe(false);
    expect(order([{ ...item, item_id: "buffalo-wings" }]).success).toBe(false);
  });
  it("drops a price sent by the browser: the schema has no price field", () => {
    const r = order([{ ...item, price: 1, unit_price: 1, line_total: 1 }]);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.items[0]).not.toHaveProperty("price");
    if (r.success) expect(r.data.items[0]).not.toHaveProperty("unit_price");
  });
  it("rejects a missing or oversized token and a note over 500 characters", () => {
    expect(preOrderSchema.safeParse({ token: "short", items: [] }).success).toBe(false);
    expect(preOrderSchema.safeParse({ token: "x".repeat(2049), items: [] }).success).toBe(false);
    expect(order([], { notes: "x".repeat(501) }).success).toBe(false);
  });
});

describe("errorKey", () => {
  it("extracts the PW_ code from a database error", () => {
    expect(errorKey({ message: 'ERROR: PW_SLOT_FULL (SQLSTATE P0001)' })).toBe("PW_SLOT_FULL");
    expect(errorKey("PW_TOO_SOON")).toBe("PW_TOO_SOON");
  });
  it("never passes a raw database message through", () => {
    expect(errorKey({ message: 'duplicate key value violates unique constraint "reservations_pkey"' })).toBe("generic");
    expect(errorKey(null)).toBe("generic");
    expect(errorKey(42)).toBe("generic");
  });
});
