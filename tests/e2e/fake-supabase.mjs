// A stateful stand-in for the Supabase endpoints the website uses, for the Playwright tests only:
// Auth (password sign-in, session check, sign-out), PostgREST tables and the RPCs. The website is
// built against it (NEXT_PUBLIC_SUPABASE_URL), so the real server actions, data layer, proxy and
// browser clients run unchanged, and no test ever touches a real database or sends email.
//
// It mirrors the booking rules only roughly (hours, half hours, lead time, 8 seats per area, the
// status transitions from the migration). The real rules are tested against Postgres in tests/db.
//
// Test control: POST /__reset, POST /__fail {"METHOD /path": status}, POST /__revoke (end every
// session), POST /__seed {reservation fields} -> {id}, GET /__state.
import http from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54329);
const sample = JSON.parse(readFileSync(new URL("../../src/lib/preview/sample-data.json", import.meta.url), "utf8"));
export const STAFF = { email: "manager@pinewood.test", password: "correct-horse-battery", id: "11111111-1111-4111-8111-111111111111" };

const BRANCHES = [
  ["dhanmondi-6", "Dhanmondi, Road 6"],
  ["dhanmondi-27", "Dhanmondi, Road 27"],
  ["banani", "Banani"],
].map(([slug, name], i) => ({ id: `00000000-0000-4000-8000-00000000000${i + 1}`, slug, name_en: name, name_bn: name, is_active: true, sort_order: i + 1 }));
const AREAS = BRANCHES.flatMap((b, i) => [
  { id: `a0000000-0000-4000-8000-0000000000${i}1`, slug: `${b.slug}-inside`, name_en: "Inside", name_bn: "ভেতরে", description_en: null, description_bn: null, is_active: true, sort_order: 1, branch_id: b.id, seating: "inside" },
  { id: `a0000000-0000-4000-8000-0000000000${i}2`, slug: `${b.slug}-outside`, name_en: "Outside", name_bn: "বাইরে", description_en: null, description_bn: null, is_active: true, sort_order: 2, branch_id: b.id, seating: "outside" },
]);
const SEATS = 8;
const HOURS = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ id: `h${weekday}`, branch_id: null, weekday, opens_at: "10:00", closes_at: "22:00", is_closed: false }));
const LEGAL = { pending: ["confirmed", "rejected", "cancelled", "expired"], confirmed: ["seated", "cancelled", "no_show", "completed"], seated: ["completed"] };

let s;
function reset() {
  s = {
    menu: structuredClone(sample.menu),
    reservations: [],
    holds: [],
    sessions: new Map(), // access token -> user id
    failures: {},
    hits: {},
  };
}
reset();

const dhakaDay = (iso) => new Date(new Date(iso).getTime() + 6 * 3600_000).toISOString().slice(0, 10);
const hoursFor = (day) => HOURS.find((h) => h.weekday === new Date(`${day}T12:00:00+06:00`).getUTCDay());
const at = (day, hhmm) => new Date(`${day}T${hhmm}:00+06:00`);
const active = (r) => ["pending", "confirmed", "seated"].includes(r.status);
const load = (areaId, start, end) =>
  s.reservations.filter((r) => r.area_id === areaId && active(r) && new Date(r.starts_at) < end && new Date(r.ends_at) > start).reduce((n, r) => n + r.party_size, 0) +
  s.holds.filter((h) => h.area_id === areaId && h.expires > Date.now() && h.start < end && h.end > start).reduce((n, h) => n + h.party, 0);
const pwError = (code, status = 400) => ({ status, body: { code: "P0001", message: code, details: null, hint: null } });

function schedule(days, branch) {
  const today = dhakaDay(new Date().toISOString());
  return Array.from({ length: days }, (_, n) => {
    const day = new Date(new Date(`${today}T12:00:00+06:00`).getTime() + n * 86400_000).toISOString().slice(0, 10);
    const h = hoursFor(day);
    return { day, opens: h ? at(day, h.opens_at).toISOString() : null, closes: h ? at(day, h.closes_at).toISOString() : null, label: null, branch };
  });
}

function availability({ p_date, p_party_size, p_duration_minutes, p_branch }) {
  const h = hoursFor(p_date);
  if (!h) return [];
  const out = [];
  const dur = (p_duration_minutes ?? 90) * 60_000;
  for (let t = at(p_date, h.opens_at).getTime(); t + dur <= at(p_date, h.closes_at).getTime(); t += 30 * 60_000) {
    if (t < Date.now() + 60 * 60_000) continue;
    for (const a of AREAS.filter((x) => x.branch_id === (p_branch ?? null) && x.is_active)) {
      const remaining = Math.max(SEATS - load(a.id, new Date(t), new Date(t + dur)), 0);
      out.push({ slot_start: new Date(t).toISOString(), slot_end: new Date(t + dur).toISOString(), area_id: a.id, capacity: SEATS, remaining, available: remaining >= p_party_size, waitlist_eligible: false });
    }
  }
  return out;
}

function holdSlot({ p_area, p_start, p_duration_minutes, p_party_size, p_client_key }) {
  const area = AREAS.find((a) => a.id === p_area && a.is_active);
  if (!area) return pwError("PW_INVALID_AREA");
  if (p_party_size < 1 || p_party_size > 10) return pwError("PW_INVALID_PARTY");
  const start = new Date(p_start);
  const end = new Date(start.getTime() + p_duration_minutes * 60_000);
  if (start.getTime() < Date.now() + 60 * 60_000) return pwError("PW_TOO_SOON");
  const day = dhakaDay(p_start);
  const h = hoursFor(day);
  if (!h || start < at(day, h.opens_at) || end > at(day, h.closes_at)) return pwError("PW_OUTSIDE_HOURS");
  if (start.getUTCMinutes() % 30 !== 0) return pwError("PW_INVALID_SLOT");
  s.holds = s.holds.filter((x) => x.client !== p_client_key);
  if (SEATS - load(p_area, start, end) < p_party_size) return pwError("PW_SLOT_FULL");
  const hold = { id: randomUUID(), area_id: p_area, start, end, party: p_party_size, client: p_client_key, expires: Date.now() + 10 * 60_000 };
  s.holds.push(hold);
  return { status: 200, body: [{ hold_id: hold.id, expires_at: new Date(hold.expires).toISOString() }] };
}

function newReservation(fields) {
  const r = {
    id: randomUUID(),
    reference: `PW-${Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[01OI]/g, "7")}`,
    status: "pending",
    source: "web",
    large_party: false,
    locale: "en",
    special_requests: null,
    token_version: 1,
    cancel_requested_at: null,
    cancel_reason: null,
    staff_notes: null,
    confirmed_at: null,
    expires_at: null,
    created_at: new Date().toISOString(),
    ...fields,
  };
  s.reservations.push(r);
  return r;
}

function createReservation({ p_hold_id, p_client_key, p_name, p_phone, p_email, p_requests, p_locale }) {
  const hold = s.holds.find((h) => h.id === p_hold_id && h.client === p_client_key);
  if (!hold) return pwError("PW_HOLD_NOT_FOUND");
  s.holds = s.holds.filter((h) => h !== hold);
  const r = newReservation({
    area_id: hold.area_id,
    starts_at: hold.start.toISOString(),
    ends_at: hold.end.toISOString(),
    party_size: hold.party,
    customer_name: p_name.trim(),
    phone: p_phone,
    email: p_email.trim().toLowerCase(),
    special_requests: p_requests?.trim() || null,
    locale: p_locale ?? "en",
  });
  return { status: 200, body: [{ reservation_id: r.id, reference: r.reference }] };
}

const areaOf = (r) => AREAS.find((a) => a.id === r.area_id);
const branchOf = (r) => BRANCHES.find((b) => b.id === areaOf(r)?.branch_id);
function adminRow(r) {
  const a = areaOf(r);
  const b = branchOf(r);
  return {
    ...r,
    area: { id: a.id, slug: a.slug, name: a.name_en, seating: a.seating },
    branch: b ? { id: b.id, slug: b.slug, name: b.name_en } : null,
    tables: [],
    history: { bookings: 0, visits: 0, no_shows: 0, cancellations: 0 },
    pre_order: null,
    last_email: null,
  };
}

function userFrom(req) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /i, "");
  return s.sessions.get(token) ?? null;
}
const staffOnly = (req, fn) => (userFrom(req) ? fn() : pwError("PW_FORBIDDEN"));

function jwt(sub) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, email: STAFF.email, role: "authenticated", aud: "authenticated", exp, session_id: randomUUID() })}.${Buffer.from("fake").toString("base64url")}`;
}
const USER = { id: STAFF.id, aud: "authenticated", role: "authenticated", email: STAFF.email, app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
function session() {
  const access_token = jwt(STAFF.id);
  s.sessions.set(access_token, STAFF.id);
  return { access_token, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: randomUUID(), user: USER };
}

// PostgREST filters: ?col=eq.value (only what the site sends).
const filters = (url) => [...url.searchParams].filter(([k]) => !["select", "order", "limit", "offset"].includes(k));
const matches = (row, url) =>
  filters(url).every(([k, v]) => {
    const [op, ...rest] = v.split(".");
    const val = rest.join(".");
    if (op === "eq") return String(row[k]) === val;
    if (op === "is") return row[k] === null && val === "null";
    if (op === "gte") return row[k] >= val;
    if (op === "lt") return row[k] < val;
    if (op === "in") return val.replace(/[()]/g, "").split(",").includes(String(row[k]));
    return true;
  });

function table(req, url, body) {
  const name = url.pathname.split("/").pop();
  const one = /vnd\.pgrst\.object/.test(req.headers.accept ?? "");
  const reply = (rows) => (one ? (rows.length === 1 ? { status: 200, body: rows[0] } : { status: 406, body: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } }) : { status: 200, body: rows });
  switch (name) {
    case "menu_categories":
      return reply(s.menu);
    case "areas":
      return reply(AREAS.filter((a) => matches(a, url)));
    case "branches":
      return reply(BRANCHES.filter((b) => matches(b, url)));
    case "opening_hours":
      return reply(HOURS);
    case "staff_profiles":
      return reply(userFrom(req) || filters(url).some(([, v]) => v === `eq.${STAFF.id}`) ? [{ user_id: STAFF.id, full_name: "Test Manager", role: "manager", is_active: true }] : []);
    case "waitlist_entries":
    case "pre_orders":
      return reply([]);
    case "reservations": {
      const rows = s.reservations.filter((r) => matches(r, url)).map((r) => ({ ...r, area: { name_en: areaOf(r).name_en, name_bn: areaOf(r).name_bn }, pre_orders: [] }));
      return reply(rows);
    }
    case "menu_items": {
      if (req.method !== "PATCH") return reply([]);
      // Row-level security stand-in: only a signed-in manager's update changes anything.
      if (userFrom(req)) {
        const id = url.searchParams.get("id")?.replace(/^eq\./, "");
        for (const c of s.menu) for (const i of c.menu_items) if (i.id === id) Object.assign(i, body);
      }
      return { status: 204 };
    }
    default:
      return { status: 404, body: { message: `fake: no table ${name}` } };
  }
}

function rpc(req, name, a) {
  switch (name) {
    case "get_schedule":
      return { status: 200, body: schedule(a.p_days ?? 14, a.p_branch ?? null) };
    case "get_availability":
      return { status: 200, body: availability(a) };
    case "hold_slot":
      return holdSlot(a);
    case "create_reservation":
      return createReservation(a);
    case "admin_list_reservations":
      return staffOnly(req, () => ({
        status: 200,
        body: s.reservations
          .filter((r) => dhakaDay(r.starts_at) >= a.p_from && dhakaDay(r.starts_at) <= a.p_to)
          .sort((x, y) => x.starts_at.localeCompare(y.starts_at))
          .map(adminRow),
      }));
    case "admin_list_pre_orders":
      return staffOnly(req, () => ({ status: 200, body: [] }));
    case "admin_set_status":
      return staffOnly(req, () => {
        const r = s.reservations.find((x) => x.id === a.p_id);
        if (!r) return pwError("PW_NOT_FOUND");
        if (r.status !== a.p_status && !(LEGAL[r.status] ?? []).includes(a.p_status)) return pwError("PW_INVALID_TRANSITION");
        r.status = a.p_status;
        if (a.p_status === "confirmed") r.confirmed_at = new Date().toISOString();
        return { status: 204 };
      });
    case "admin_resend_email":
      return staffOnly(req, () => ({ status: 204 }));
    case "admin_delete_reservation":
      return staffOnly(req, () => {
        const i = s.reservations.findIndex((x) => x.id === a.p_id);
        if (i === -1) return pwError("PW_NOT_FOUND");
        if (["pending", "confirmed", "seated"].includes(s.reservations[i].status)) return pwError("PW_NOT_DELETABLE");
        s.reservations.splice(i, 1);
        return { status: 204 };
      });
    case "request_cancellation": {
      const r = s.reservations.find((x) => x.id === a.p_reservation);
      if (!r || !["pending", "confirmed"].includes(r.status)) return pwError("PW_CANNOT_CANCEL");
      r.cancel_requested_at ??= new Date().toISOString();
      return { status: 204 };
    }
    default:
      return { status: 404, body: { message: `fake: no function ${name}` } };
  }
}

function auth(req, url, body) {
  const path = url.pathname.replace("/auth/v1", "");
  if (path === "/token" && url.searchParams.get("grant_type") === "password") {
    if (body.email?.toLowerCase() !== STAFF.email || body.password !== STAFF.password) {
      return { status: 400, body: { code: "invalid_credentials", error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials" } };
    }
    return { status: 200, body: session() };
  }
  if (path === "/token" && url.searchParams.get("grant_type") === "refresh_token") return { status: 400, body: { error: "invalid_grant", error_description: "Refresh token not found" } };
  if (path === "/user") return userFrom(req) ? { status: 200, body: USER } : { status: 401, body: { code: "bad_jwt", message: "invalid JWT" } };
  if (path === "/logout") {
    s.sessions.delete((req.headers.authorization ?? "").replace(/^Bearer /i, ""));
    return { status: 204 };
  }
  return { status: 404, body: { message: `fake: no auth route ${path}` } };
}

function control(url, body) {
  switch (url.pathname) {
    case "/__reset":
      reset();
      return { status: 200, body: { ok: true } };
    case "/__fail":
      s.failures = body;
      return { status: 200, body: s.failures };
    case "/__revoke":
      s.sessions.clear();
      return { status: 200, body: { ok: true } };
    case "/__seed": {
      const area = AREAS.find((x) => x.slug === (body.area ?? "banani-inside"));
      const starts = body.starts_at;
      const r = newReservation({ area_id: area.id, starts_at: starts, ends_at: new Date(new Date(starts).getTime() + 90 * 60_000).toISOString(), party_size: 2, phone: "+8801711000000", email: "seeded@test.local", ...body, area: undefined });
      delete r.area;
      return { status: 200, body: r };
    }
    case "/__state":
      return { status: 200, body: { reservations: s.reservations, holds: s.holds.length, hits: s.hits, prices: s.menu.flatMap((c) => c.menu_items.map((i) => [i.id, i.price])) } };
    default:
      return null;
  }
}

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://fake");
    const cors = { "access-control-allow-origin": req.headers.origin ?? "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-allow-credentials": "true" };
    const send = ({ status, body }) => {
      res.writeHead(status, { "content-type": "application/json", ...cors });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };
    if (req.method === "OPTIONS") return send({ status: 204 });
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return send({ status: 400, body: { message: "invalid json" } });
    }
    const ctl = control(url, body);
    if (ctl) return send(ctl);

    const key = `${req.method} ${url.pathname}`;
    s.hits[key] = (s.hits[key] ?? 0) + 1;
    if (s.failures[key]) return send({ status: s.failures[key], body: { code: "XX000", message: 'internal error: relation "secret_table" does not exist' } });
    if (url.pathname.startsWith("/auth/v1")) return send(auth(req, url, body));
    if (url.pathname.startsWith("/rest/v1/rpc/")) return send(rpc(req, url.pathname.split("/").pop(), body));
    if (url.pathname.startsWith("/rest/v1/")) return send(table(req, url, body));
    send({ status: 404, body: { message: `fake: ${key}` } });
  });
});
// Realtime: refuse the socket (the pages keep working without live updates).
server.on("upgrade", (_req, socket) => socket.destroy());
server.listen(PORT, "127.0.0.1", () => console.log(`fake supabase on ${PORT}`));
