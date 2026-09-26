// Pre-orders (upsert_pre_order): prices always come from the menu, never from the browser; items,
// quantities and the cut-off are enforced; saved lines keep a snapshot of what was ordered.
// The dishes below are TEST FIXTURES with known prices.
import { beforeAll, describe, expect, it } from "vitest";
import { book, dhaka, pwError, setStatus, standardFixture, openTestDb } from "./helpers";

const db = openTestDb();
let A: Record<string, string>;
let dish: string, off: string, other: string;
let large: string, cheese: string, otherAddon: string;

beforeAll(async () => {
  A = (await standardFixture(db)).areas;
  const [cat] = await db.q<{ id: string }>("select id from public.menu_categories order by sort_order limit 1");
  const item = async (slug: string, price: number, available = true) =>
    (
      await db.q<{ id: string }>(
        "insert into public.menu_items (category_id, slug, name_en, name_bn, price, is_available) values ($1, $2, $2, $2, $3, $4) returning id",
        [cat.id, slug, price, available],
      )
    )[0].id;
  dish = await item("test-dish", 500);
  off = await item("test-sold-out", 300, false);
  other = await item("test-other", 200);
  await db.q("insert into public.menu_item_variants (item_id, name_en, name_bn, price_delta, is_default, sort_order) values ($1, 'Regular', 'Regular', 0, true, 1)", [dish]);
  large = (await db.q<{ id: string }>("insert into public.menu_item_variants (item_id, name_en, name_bn, price_delta, is_default, sort_order) values ($1, 'Large', 'Large', 100, false, 2) returning id", [dish]))[0].id;
  cheese = (await db.q<{ id: string }>("insert into public.menu_item_addons (item_id, name_en, name_bn, price, sort_order) values ($1, 'Cheese', 'Cheese', 50, 1) returning id", [dish]))[0].id;
  otherAddon = (await db.q<{ id: string }>("insert into public.menu_item_addons (item_id, name_en, name_bn, price, sort_order) values ($1, 'Sauce', 'Sauce', 30, 1) returning id", [other]))[0].id;
});

let n = 0;
async function confirmedBooking() {
  const b = await book(db, { area: A.d27, start: dhaka(2 + (n % 20), `${12 + (Math.floor(n++ / 20) % 8)}:00`), party: 2 });
  await setStatus(db, b.id, "confirmed");
  return b.id;
}
const save = (reservation: string, items: unknown[], notes = "") =>
  db.as<{ id: string | null }>("service_role", "select public.upsert_pre_order($1, $2::jsonb, $3) as id", [reservation, JSON.stringify(items), notes]);
const order = async (reservation: string) => {
  const [po] = await db.q<{ id: string; total: string; status: string }>("select id, total, status from public.pre_orders where reservation_id = $1", [reservation]);
  const lines = po
    ? await db.q<{ item_name: string; variant_name: string | null; addon_names: string[]; unit_price: string; quantity: number; line_total: string }>(
        "select item_name, variant_name, addon_names, unit_price, quantity, line_total from public.pre_order_items where pre_order_id = $1 order by item_name",
        [po.id],
      )
    : [];
  return { po, lines };
};

describe("prices are computed by the database", () => {
  it("dish + size + add-on, times quantity", async () => {
    const r = await confirmedBooking();
    await save(r, [{ item_id: dish, variant_id: large, addon_ids: [cheese], quantity: 2 }]);
    const { po, lines } = await order(r);
    expect(Number(po.total)).toBe(1300); // (500 + 100 + 50) x 2
    expect(lines[0]).toMatchObject({ item_name: "test-dish", variant_name: "Large", addon_names: ["Cheese"], quantity: 2 });
    expect(Number(lines[0].unit_price)).toBe(650);
  });
  it("ignores any price the browser sends", async () => {
    const r = await confirmedBooking();
    await save(r, [{ item_id: dish, quantity: 1, price: 1, unit_price: 1, line_total: 1, total: 1 }]);
    const { po, lines } = await order(r);
    expect(Number(lines[0].unit_price)).toBe(500); // default size, no add-ons
    expect(Number(po.total)).toBe(500);
  });
  it("keeps the saved prices and names when the menu changes later (snapshot)", async () => {
    const r = await confirmedBooking();
    await save(r, [{ item_id: other, quantity: 3 }]);
    await db.q("update public.menu_items set price = 999, name_en = 'renamed' where id = $1", [other]);
    const { po, lines } = await order(r);
    expect(lines[0]).toMatchObject({ item_name: "test-other", quantity: 3 });
    expect(Number(po.total)).toBe(600);
    await db.q("update public.menu_items set price = 200, name_en = 'test-other' where id = $1", [other]);
  });
});

describe("items and quantities", () => {
  it("refuses a sold-out or unknown dish", async () => {
    const r = await confirmedBooking();
    await expect(save(r, [{ item_id: off, quantity: 1 }])).rejects.toThrow(pwError("PW_ITEM_UNAVAILABLE"));
    await expect(save(r, [{ item_id: "00000000-0000-4000-8000-000000000000", quantity: 1 }])).rejects.toThrow(pwError("PW_ITEM_UNAVAILABLE"));
  });
  it("refuses another dish's size or add-on", async () => {
    const r = await confirmedBooking();
    const [otherVariant] = await db.q<{ id: string }>("insert into public.menu_item_variants (item_id, name_en, name_bn, price_delta, is_default, sort_order) values ($1, 'X', 'X', 0, true, 1) returning id", [other]);
    await expect(save(r, [{ item_id: dish, variant_id: otherVariant.id, quantity: 1 }])).rejects.toThrow(pwError("PW_INVALID_VARIANT"));
    await expect(save(r, [{ item_id: dish, addon_ids: [otherAddon], quantity: 1 }])).rejects.toThrow(pwError("PW_INVALID_ADDON"));
    await db.q("delete from public.menu_item_variants where id = $1", [otherVariant.id]);
  });
  it("quantity 1 and 20 are fine, 0 and 21 are refused", async () => {
    const r = await confirmedBooking();
    expect((await save(r, [{ item_id: other, quantity: 1 }, { item_id: dish, quantity: 20 }]))[0].id).toBeTruthy();
    for (const quantity of [0, 21, null]) {
      await expect(save(r, [{ item_id: other, quantity }])).rejects.toThrow(pwError("PW_INVALID_QUANTITY"));
    }
  });
  it("at most 40 lines", async () => {
    const r = await confirmedBooking();
    await expect(save(r, Array(41).fill({ item_id: other, quantity: 1 }))).rejects.toThrow(pwError("PW_INVALID_ITEMS"));
  });
});

describe("saving again, locking and cut-off", () => {
  it("saving again replaces the order instead of adding a second one", async () => {
    const r = await confirmedBooking();
    await save(r, [{ item_id: dish, quantity: 1 }]);
    await save(r, [{ item_id: other, quantity: 2 }]);
    const { po, lines } = await order(r);
    expect(lines.map((l) => l.item_name)).toEqual(["test-other"]);
    expect(Number(po.total)).toBe(400);
    expect((await db.q("select 1 from public.pre_orders where reservation_id = $1", [r])).length).toBe(1);
  });
  it("an empty save removes the order", async () => {
    const r = await confirmedBooking();
    await save(r, [{ item_id: dish, quantity: 1 }]);
    expect((await save(r, []))[0].id).toBeNull();
    expect((await order(r)).po).toBeUndefined();
  });
  it("is locked once the kitchen starts preparing", async () => {
    const r = await confirmedBooking();
    await save(r, [{ item_id: dish, quantity: 1 }]);
    await db.q("update public.pre_orders set status = 'preparing' where reservation_id = $1", [r]);
    await expect(save(r, [{ item_id: other, quantity: 1 }])).rejects.toThrow(pwError("PW_PREORDER_LOCKED"));
  });
  it("only confirmed bookings can pre-order", async () => {
    const pending = await book(db, { area: A.d27, start: dhaka(25, "12:00") });
    await expect(save(pending.id, [{ item_id: dish, quantity: 1 }])).rejects.toThrow(pwError("PW_PREORDER_CLOSED"));
    const cancelled = await confirmedBooking();
    await setStatus(db, cancelled, "cancelled");
    await expect(save(cancelled, [{ item_id: dish, quantity: 1 }])).rejects.toThrow(pwError("PW_PREORDER_CLOSED"));
  });
  it("staff status changes: served and cancelled are final; only the guest sets submitted", async () => {
    const r = await confirmedBooking();
    await save(r, [{ item_id: dish, quantity: 1 }]);
    const { po } = await order(r);
    const staff = (await db.q<{ user_id: string }>("select user_id from public.staff_profiles where is_active limit 1"))[0].user_id;
    const set = (status: string) => db.as("authenticated", "select public.admin_set_pre_order_status($1, $2::public.preorder_status)", [po.id, status], staff);
    await set("acknowledged");
    await set("preparing");
    await expect(set("submitted")).rejects.toThrow(pwError("PW_INVALID_TRANSITION"));
    await set("served");
    await expect(set("preparing")).rejects.toThrow(pwError("PW_INVALID_TRANSITION"));
    expect((await order(r)).po.status).toBe("served");
    await expect(
      db.as("authenticated", "select public.admin_set_pre_order_status(gen_random_uuid(), 'ready')", [], staff),
    ).rejects.toThrow(pwError("PW_NOT_FOUND"));
  });
  it("closes 60 minutes before the booking", async () => {
    const [soon] = await db.q<{ id: string }>(
      `insert into public.reservations (area_id, starts_at, ends_at, party_size, customer_name, phone, email, status)
       values ($1, now() + interval '45 minutes', now() + interval '135 minutes', 2, 'Soon', '+8801766000001', 's@test.local', 'confirmed') returning id`,
      [A.d27],
    );
    await expect(save(soon.id, [{ item_id: dish, quantity: 1 }])).rejects.toThrow(pwError("PW_PREORDER_CUTOFF"));
  });
});
