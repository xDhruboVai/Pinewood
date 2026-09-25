// Frontend preview only (PW_PREVIEW=1): a tiny in-memory stand-in for the database so the admin
// dashboard can be looked at without Supabase. Sample bookings are generated around today's date.
// Nothing here is saved; writes are accepted and ignored. Never used in production builds.
import { composeBookingNotes } from "@/lib/booking-notes";
import { PREVIEW_BRANCHES } from "./branches";
import { dhakaDate } from "@/lib/format";
import type { AdminPreOrder, AdminReservation, Analytics, MenuCategory, ReservationStatus } from "@/lib/types";
import sample from "./sample-data.json";

export const PREVIEW_USER = { id: "preview-manager", email: "manager@preview.local", name: "Preview Manager" };

const iso = (day: string, time: string) => new Date(`${day}T${time}:00+06:00`).toISOString();
const addMinutes = (isoString: string, m: number) => new Date(new Date(isoString).getTime() + m * 60_000).toISOString();

const areas = sample.areas;
const tables = areas.flatMap((a, i) =>
  [2, 4, 4, 6].map((seats, n) => ({ id: `table-${a.slug}-${n + 1}`, area_id: a.id, label: `${"FSHR"[i] ?? "T"}${n + 1}`, seats, is_active: true })),
);
const menuItems = (sample.menu as unknown as MenuCategory[]).flatMap((c) => c.menu_items);

const GUESTS = ["Nusrat Jahan", "Tanvir Ahmed", "Farhana Rahman", "Arif Hossain", "Sadia Islam", "Imran Kabir", "Mehnaz Chowdhury", "Rafiq Uddin", "Tasnia Haque", "Zubair Alam"];

// [day offset, time, party, status, has pre-order, cancel requested]
const PLAN: [number, string, number, ReservationStatus, boolean, boolean][] = [
  [0, "12:30", 2, "completed", false, false],
  [0, "13:00", 4, "seated", false, false],
  [0, "19:00", 6, "confirmed", true, false],
  [0, "19:30", 2, "confirmed", false, false],
  [0, "20:00", 4, "pending", false, false],
  [0, "20:30", 3, "pending", false, false],
  [0, "21:00", 5, "confirmed", true, false],
  [1, "13:30", 2, "confirmed", false, false],
  [1, "19:00", 8, "pending", false, false],
  [1, "20:00", 4, "confirmed", false, true],
  [2, "12:00", 3, "confirmed", true, false],
  [2, "20:30", 2, "pending", false, false],
  [3, "19:30", 6, "confirmed", false, false],
  [4, "13:00", 4, "pending", false, false],
  [5, "20:00", 10, "confirmed", false, false],
  [6, "19:00", 2, "cancelled", false, false],
];

function preOrderItems(seed: number) {
  const picks = [menuItems[(seed * 7) % menuItems.length], menuItems[(seed * 13 + 5) % menuItems.length], menuItems[(seed * 3 + 11) % menuItems.length]];
  return picks.map((m, i) => ({ id: `poi-${seed}-${i}`, name: m.name_en, variant: null, addons: [], quantity: 1 + ((seed + i) % 2), notes: null, line_total: Number(m.price) * (1 + ((seed + i) % 2)) }));
}

// Sample bookings with a branch (the others stand for bookings made before branches existed).
const sampleBranch = (i: number) => (i === 2 ? PREVIEW_BRANCHES[1] : i % 3 === 0 ? PREVIEW_BRANCHES[i % 2 ? 2 : 0] : null);

export const RESERVATIONS: AdminReservation[] = PLAN.map(([offset, time, party, status, pre, cancel], i) => {
  const day = dhakaDate(offset);
  const branch = sampleBranch(i);
  const starts = iso(day, time);
  const area = areas[i % areas.length];
  const items = pre ? preOrderItems(i) : [];
  return {
    id: `res-${i + 1}`,
    reference: `PW-${(4200 + i * 37).toString(36).toUpperCase()}`,
    status,
    source: i % 5 === 3 ? "staff" : "web",
    starts_at: starts,
    ends_at: addMinutes(starts, 90),
    party_size: party,
    large_party: party >= 10,
    customer_name: GUESTS[i % GUESTS.length],
    phone: `+88017000000${String(10 + i)}`,
    email: `guest${i + 1}@example.com`,
    // Same format the booking form writes (lib/booking-notes); older sample bookings have none.
    special_requests:
      i === 2
        ? composeBookingNotes({ branch: branch?.name_en, seating: "inside", note: "Birthday, a quiet table please" })
        : branch
          ? composeBookingNotes({ branch: branch.name_en, seating: i % 2 ? "outside" : "inside", note: "" })
          : null,
    branch: branch ? { id: branch.id, slug: branch.slug, name: branch.name_en } : null,
    locale: i % 4 === 1 ? "bn" : "en",
    expires_at: status === "pending" ? addMinutes(new Date().toISOString(), 60 * (3 + i)) : null,
    confirmed_at: ["confirmed", "seated", "completed"].includes(status) ? addMinutes(starts, -60 * 24) : null,
    cancel_requested_at: cancel ? addMinutes(new Date().toISOString(), -90) : null,
    cancel_reason: cancel ? "Plans changed" : null,
    staff_notes: i === 4 ? "Called once, no answer. Try again after 5pm." : null,
    created_at: addMinutes(starts, -60 * 48),
    area: { id: area.id, slug: area.slug, name: area.name_en },
    tables: ["confirmed", "seated", "completed"].includes(status) ? [tables.find((t) => t.area_id === area.id && t.seats >= Math.min(party, 6)) ?? tables[0]].map((t) => ({ id: t.id, label: t.label, seats: t.seats })) : [],
    history: { bookings: 1 + (i % 4), visits: i % 4, no_shows: i === 8 ? 1 : 0, cancellations: 0 },
    pre_order: pre ? { id: `po-${i + 1}`, status: i % 2 ? "acknowledged" : "submitted", total: items.reduce((s, x) => s + x.line_total, 0), item_count: items.length } : null,
    last_email: status === "pending" ? { kind: "received", status: "sent", at: addMinutes(starts, -60 * 48), error: null } : { kind: "confirmed", status: "sent", at: addMinutes(starts, -60 * 24), error: null },
  };
});

const PRE_ORDERS: AdminPreOrder[] = RESERVATIONS.filter((r) => r.pre_order).map((r, n) => ({
  id: r.pre_order!.id,
  status: r.pre_order!.status,
  notes: n === 0 ? "Please bring the cake out with dessert" : null,
  total: r.pre_order!.total,
  submitted_at: addMinutes(r.starts_at, -60 * 20),
  reservation: {
    id: r.id,
    reference: r.reference,
    status: r.status,
    customer_name: r.customer_name,
    phone: r.phone,
    party_size: r.party_size,
    starts_at: r.starts_at,
    area: r.area.name,
    branch: r.branch?.name ?? null,
    tables: r.tables.map((t) => t.label),
  },
  items: preOrderItems(Number(r.id.split("-")[1]) - 1),
}));

const WAITLIST = [
  {
    id: "wl-1",
    area_id: areas[2].id,
    starts_at: iso(dhakaDate(0), "20:00"),
    ends_at: iso(dhakaDate(0), "21:30"),
    party_size: 4,
    large_party: false,
    customer_name: "Shafiq Rahman",
    phone: "+8801700000099",
    email: "waitlist@example.com",
    status: "waiting",
    created_at: new Date().toISOString(),
  },
];

const STAFF = [
  { user_id: PREVIEW_USER.id, full_name: PREVIEW_USER.name, role: "manager", is_active: true, created_at: "2026-01-01T00:00:00Z" },
  { user_id: "preview-foh", full_name: "Front of House", role: "foh", is_active: true, created_at: "2026-02-01T00:00:00Z" },
];

function analytics(days: number): Analytics {
  const daily = Array.from({ length: days }, (_, n) => {
    const day = dhakaDate(n - days + 1);
    const bookings = 6 + ((n * 7) % 9);
    return { day, bookings, covers: bookings * 3 + ((n * 5) % 7) };
  });
  const covers = daily.reduce((s, d) => s + d.covers, 0);
  const requests = daily.reduce((s, d) => s + d.bookings, 0) + Math.round(days * 0.8);
  return {
    daily_covers: daily,
    peak_hours: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map((hour) => ({ hour, covers: [18, 34, 22, 9, 8, 12, 26, 48, 55, 30][hour - 12] * Math.max(1, Math.round(days / 30)) })),
    top_items: menuItems
      .filter((m) => m.is_featured)
      .slice(0, 6)
      .map((m, i) => ({ name: m.name_en, quantity: 40 - i * 5, revenue: (40 - i * 5) * Number(m.price) })),
    totals: { requests, confirmed: Math.round(requests * 0.82), no_shows: Math.round(requests * 0.03), expired: Math.round(requests * 0.06), covers },
  };
}

const TABLES: Record<string, unknown[]> = {
  areas,
  dining_tables: tables,
  blockouts: [],
  hours_overrides: [],
  opening_hours: sample.opening_hours,
  waitlist_entries: WAITLIST,
  reservations: RESERVATIONS,
  branches: PREVIEW_BRANCHES,
  staff_profiles: STAFF,
  menu_categories: sample.menu,
  reviews: sample.reviews,
};

// ---------------------------------------------------------------------------------------------
// Query builder: from("table").select().eq()... resolves like Supabase ({ data, error, count }).

const toComparable = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(v.length === 10 ? `${v}T00:00:00+06:00` : v).getTime() : v);
const cmp = (a: unknown, b: unknown) => {
  const x = toComparable(a) as number | string;
  const y = toComparable(b) as number | string;
  return x < y ? -1 : x > y ? 1 : 0;
};

type Row = Record<string, unknown>;

export function fakeFrom(table: string) {
  let rows = [...((TABLES[table] ?? []) as Row[])];
  let head = false;
  let wantCount = false;
  let one: "single" | "maybe" | null = null;
  const builder = {
    select(_cols?: string, opts?: { count?: string; head?: boolean }) {
      head = Boolean(opts?.head);
      wantCount = Boolean(opts?.count);
      return builder;
    },
    eq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), builder),
    neq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] !== v)), builder),
    gt: (c: string, v: unknown) => ((rows = rows.filter((r) => cmp(r[c], v) > 0)), builder),
    gte: (c: string, v: unknown) => ((rows = rows.filter((r) => cmp(r[c], v) >= 0)), builder),
    lt: (c: string, v: unknown) => ((rows = rows.filter((r) => cmp(r[c], v) < 0)), builder),
    lte: (c: string, v: unknown) => ((rows = rows.filter((r) => cmp(r[c], v) <= 0)), builder),
    in: (c: string, v: unknown[]) => ((rows = rows.filter((r) => v.includes(r[c]))), builder),
    is: (c: string, v: unknown) => ((rows = rows.filter((r) => (r[c] ?? null) === v)), builder),
    order: () => builder,
    limit: (n: number) => ((rows = rows.slice(0, n)), builder),
    range: (a: number, b: number) => ((rows = rows.slice(a, b + 1)), builder),
    single: () => ((one = "single"), builder),
    maybeSingle: () => ((one = "maybe"), builder),
    // Writes are accepted and ignored in the preview.
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    delete: () => builder,
    then<T>(resolve: (v: { data: unknown; error: null; count: number | null }) => T, reject?: (e: unknown) => T) {
      const data = head ? null : one ? (rows[0] ?? null) : rows;
      return Promise.resolve({ data, error: null, count: wantCount ? rows.length : null }).then(resolve, reject);
    },
  };
  return builder;
}

const dhakaDay = (isoString: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(isoString));

export async function fakeRpc(name: string, args: Record<string, unknown> = {}): Promise<{ data: unknown; error: null }> {
  const from = String(args.p_from ?? "");
  const to = String(args.p_to ?? "");
  const inRange = (isoString: string) => {
    const d = dhakaDay(isoString);
    return (!from || d >= from) && (!to || d <= to);
  };
  switch (name) {
    case "admin_list_reservations":
      return { data: RESERVATIONS.filter((r) => inRange(r.starts_at)), error: null };
    case "admin_list_pre_orders":
      return { data: PRE_ORDERS.filter((p) => inRange(p.reservation.starts_at)), error: null };
    case "admin_analytics":
      return { data: analytics(Number(args.p_days) || 30), error: null };
    // The booking form: accept the hold and the request, save nothing.
    case "hold_slot":
      return { data: [{ hold_id: crypto.randomUUID(), expires_at: new Date(Date.now() + 10 * 60_000).toISOString() }], error: null };
    case "create_reservation":
      return { data: [{ reservation_id: crypto.randomUUID(), reference: `PW-${Math.random().toString(36).slice(2, 5).toUpperCase()}` }], error: null };
    default:
      return { data: null, error: null };
  }
}

/** Minimal auth stand-in: always signed in as the preview manager. */
export const fakeAuth = {
  getClaims: async () => ({ data: { claims: { sub: PREVIEW_USER.id, email: PREVIEW_USER.email } }, error: null }),
  getUser: async () => ({ data: { user: { id: PREVIEW_USER.id, email: PREVIEW_USER.email } }, error: null }),
  signInWithPassword: async () => ({ data: {}, error: null }),
  signOut: async () => ({ error: null }),
  updateUser: async () => ({ data: {}, error: null }),
  resetPasswordForEmail: async () => ({ data: {}, error: null }),
  verifyOtp: async () => ({ data: {}, error: null }),
  exchangeCodeForSession: async () => ({ data: {}, error: null }),
  admin: {
    listUsers: async () => ({
      data: { users: STAFF.map((s) => ({ id: s.user_id, email: s.user_id === PREVIEW_USER.id ? PREVIEW_USER.email : "foh@preview.local", last_sign_in_at: new Date().toISOString() })) },
      error: null,
    }),
    inviteUserByEmail: async () => ({ data: { user: { id: "preview-invited" } }, error: null }),
    deleteUser: async () => ({ data: {}, error: null }),
    updateUserById: async () => ({ data: {}, error: null }),
  },
};
