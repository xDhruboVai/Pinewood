// The reservation-email Edge Function (supabase/functions/reservation-email/index.ts), run in Node:
// Deno's globals are stubbed, Supabase is an in-memory fake and Resend (fetch) is recorded, so no
// email is ever sent. Covers the webhook secret, payload checks, the kind/status matrix, the
// email_log row lifecycle and Resend's idempotency key.
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyReservationToken } from "@/lib/tokens";

const ENV: Record<string, string> = {
  WEBHOOK_SECRET: "test-webhook-secret",
  SUPABASE_URL: "http://supabase.test",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
  RESERVATION_TOKEN_SECRET: "test-reservation-secret-that-is-long-enough",
  SITE_URL: "https://pinewood.test/",
  RESEND_API_KEY: "test-resend-key",
  EMAIL_FROM: "Pinewood <bookings@pinewood.test>",
};
const RES_ID = "3f1c2b4a-9d8e-4f7a-b6c5-1a2b3c4d5e6f";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({
  reservations: [] as Row[],
  email_log: [] as Row[],
  pre_orders: [] as Row[],
  inserted: [] as { table: string; row: Row }[],
  updated: [] as { table: string; patch: Row; where: [string, unknown][] }[],
}));

// Minimal PostgREST-style builder over `state`: select/eq/maybeSingle/single, update().eq()..., insert().
function from(table: "reservations" | "email_log" | "pre_orders") {
  const where: [string, unknown][] = [];
  let patch: Row | null = null;
  const rows = () => (state[table] as Row[]).filter((r) => where.every(([k, v]) => r[k] === v));
  const b = {
    select: () => b,
    eq: (k: string, v: unknown) => (where.push([k, v]), b),
    maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
    single: async () => (rows()[0] ? { data: rows()[0], error: null } : { data: null, error: { message: "JSON object requested, multiple (or no) rows returned" } }),
    update: (p: Row) => ((patch = p), b),
    insert: async (row: Row) => {
      state.inserted.push({ table, row });
      return { data: null, error: null };
    },
    then: (resolve: (v: unknown) => unknown) => {
      if (patch) {
        state.updated.push({ table, patch, where: [...where] });
        for (const r of rows()) Object.assign(r, patch);
      }
      return resolve({ data: null, error: null });
    },
  };
  return b;
}
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from }) }));

let handler: (req: Request) => Promise<Response>;
const resend = vi.fn();

beforeAll(async () => {
  vi.stubGlobal("Deno", { env: { get: (k: string) => ENV[k] }, serve: (h: typeof handler) => (handler = h) });
  vi.stubGlobal("fetch", resend);
  process.env.RESERVATION_TOKEN_SECRET = ENV.RESERVATION_TOKEN_SECRET;
  // Loaded by computed path so the TypeScript check doesn't pull the Deno-only file into the Next build.
  await import(/* @vite-ignore */ fileURLToPath(new URL("../../supabase/functions/reservation-email/index.ts", import.meta.url)));
});

function reservation(status: string, extra: Row = {}): Row {
  return {
    id: RES_ID,
    reference: "PW-TEST23",
    status,
    starts_at: "2026-10-02T13:30:00Z",
    ends_at: "2026-10-02T15:00:00Z",
    party_size: 4,
    large_party: false,
    customer_name: "Nadia Rahman",
    email: "nadia@example.test",
    phone: "+8801712345678",
    locale: "en",
    cancel_reason: null,
    token_version: 2,
    area: { name_en: "Timber Hall", name_bn: "টিম্বার হল", branch: { name_en: "Banani", name_bn: "বনানী" } },
    ...extra,
  };
}

const post = (body: unknown, secret = ENV.WEBHOOK_SECRET, method = "POST") =>
  handler(
    new Request("http://fn.test/reservation-email", {
      method,
      headers: { "x-webhook-secret": secret, "Content-Type": "application/json" },
      body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    }),
  );

beforeEach(() => {
  state.reservations = [];
  state.email_log = [];
  state.pre_orders = [];
  state.inserted = [];
  state.updated = [];
  resend.mockReset();
  resend.mockResolvedValue(new Response(JSON.stringify({ id: "re_123" }), { status: 200 }));
});

describe("request checks", () => {
  it("only accepts POST", async () => {
    expect((await post({}, ENV.WEBHOOK_SECRET, "GET")).status).toBe(405);
  });
  it("rejects a wrong or missing webhook secret before reading anything", async () => {
    state.reservations = [reservation("pending")];
    for (const secret of ["wrong", "", ENV.WEBHOOK_SECRET + "x"]) {
      expect((await post({ reservation_id: RES_ID, kind: "received" }, secret)).status).toBe(401);
    }
    expect(resend).not.toHaveBeenCalled();
  });
  it("rejects invalid JSON and invalid payloads", async () => {
    expect((await post("{not json")).status).toBe(400);
    for (const body of [
      {},
      { reservation_id: "not-a-uuid", kind: "received" },
      { reservation_id: RES_ID, kind: "declined" },
      { reservation_id: RES_ID, kind: "received", log_id: 0 },
      { reservation_id: RES_ID, kind: "received", log_id: "abc" },
      { reservation_id: RES_ID, kind: "received", log_id: 1.5 },
    ]) {
      expect((await post(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(resend).not.toHaveBeenCalled();
  });
});

describe("email_log row lifecycle and duplicates", () => {
  it("refuses a log id that doesn't belong to this booking", async () => {
    state.reservations = [reservation("pending")];
    state.email_log = [{ id: 7, reservation_id: "another", status: "queued" }];
    expect((await post({ reservation_id: RES_ID, kind: "received", log_id: 7 })).status).toBe(404);
    expect(resend).not.toHaveBeenCalled();
  });

  it.each(["sent", "failed", "skipped"])("does not send again for a row that is already %s (repeated webhook)", async (status) => {
    state.reservations = [reservation("pending")];
    state.email_log = [{ id: 7, reservation_id: RES_ID, status }];
    const res = await post({ reservation_id: RES_ID, kind: "received", log_id: 7 });
    expect(await res.json()).toEqual({ skipped: true, reason: `already ${status}` });
    expect(resend).not.toHaveBeenCalled();
  });

  it("marks the row failed when the booking no longer exists", async () => {
    state.email_log = [{ id: 7, reservation_id: RES_ID, status: "queued" }];
    expect((await post({ reservation_id: RES_ID, kind: "received", log_id: 7 })).status).toBe(404);
    expect(state.email_log[0].status).toBe("failed");
    expect(resend).not.toHaveBeenCalled();
  });

  it("sends once, with the row id as Resend's idempotency key, and marks the row sent", async () => {
    state.reservations = [reservation("confirmed")];
    state.email_log = [{ id: 42, reservation_id: RES_ID, status: "queued" }];
    const res = await post({ reservation_id: RES_ID, kind: "confirmed", log_id: 42 });
    expect(await res.json()).toEqual({ sent: true, id: "re_123" });
    expect(resend).toHaveBeenCalledTimes(1);
    const [url, init] = resend.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers["Idempotency-Key"]).toBe("pinewood-email-42");
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(["nadia@example.test"]);
    expect(body.subject).toBe("Your table is confirmed · PW-TEST23");
    expect(body.tags).toEqual([{ name: "kind", value: "confirmed" }]);
    expect(state.email_log[0]).toMatchObject({ status: "sent", provider_id: "re_123" });
    expect(state.updated.some((u) => u.table === "reservations" && "confirmation_email_at" in u.patch)).toBe(true);
  });

  it("puts a guest link in the email that the website accepts (same secret, audience, version)", async () => {
    state.reservations = [reservation("confirmed")];
    state.email_log = [{ id: 1, reservation_id: RES_ID, status: "queued" }];
    await post({ reservation_id: RES_ID, kind: "confirmed", log_id: 1 });
    const text: string = JSON.parse(resend.mock.calls[0][1].body).text;
    const token = text.match(/https:\/\/pinewood\.test\/reservation\/([\w.-]+)/)?.[1];
    expect(token).toBeTruthy();
    expect(await verifyReservationToken(token!)).toEqual({ reservationId: RES_ID, version: 2 });
  });

  it("marks the row failed (not sent) when Resend refuses", async () => {
    state.reservations = [reservation("pending")];
    state.email_log = [{ id: 9, reservation_id: RES_ID, status: "queued" }];
    resend.mockResolvedValue(new Response(JSON.stringify({ message: "domain not verified" }), { status: 403 }));
    expect((await post({ reservation_id: RES_ID, kind: "received", log_id: 9 })).status).toBe(502);
    expect(state.email_log[0].status).toBe("failed");
    expect(String(state.email_log[0].error)).toContain("domain not verified");
  });

  it("older databases without log_id: writes a new log row instead", async () => {
    state.reservations = [reservation("pending")];
    await post({ reservation_id: RES_ID, kind: "received" });
    expect(state.inserted).toEqual([{ table: "email_log", row: { reservation_id: RES_ID, kind: "received", status: "sent", provider_id: "re_123" } }]);
  });
});

describe("kind / status matrix: only the right email for the booking's current status", () => {
  const SENDS: Record<string, string[]> = {
    received: ["pending"],
    waitlist_promoted: ["pending"],
    confirmed: ["confirmed"],
    reminder: ["confirmed"],
    cancelled: ["cancelled", "rejected", "expired"],
  };
  const STATUSES = ["pending", "confirmed", "seated", "completed", "cancelled", "rejected", "expired", "no_show"];
  const cases = Object.keys(SENDS).flatMap((kind) => STATUSES.map((status) => [kind, status, SENDS[kind].includes(status)] as const));

  it.each(cases)("%s email for a %s booking: sent=%s", async (kind, status, sends) => {
    state.reservations = [reservation(status)];
    state.email_log = [{ id: 5, reservation_id: RES_ID, status: "queued" }];
    const body = await (await post({ reservation_id: RES_ID, kind, log_id: 5 })).json();
    if (sends) {
      expect(body.sent).toBe(true);
      expect(resend).toHaveBeenCalledTimes(1);
      expect(state.email_log[0].status).toBe("sent");
    } else {
      expect(body).toEqual({ skipped: true });
      expect(resend).not.toHaveBeenCalled();
      expect(state.email_log[0]).toMatchObject({ status: "skipped", error: `status is ${status}` });
    }
  });
});
