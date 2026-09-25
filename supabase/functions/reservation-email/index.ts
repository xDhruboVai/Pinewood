import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT } from "npm:jose@6";
import { renderEmail, type EmailKind, type ReservationForEmail } from "./templates.ts";

const KINDS: EmailKind[] = ["received", "waitlist_promoted", "confirmed", "cancelled", "reminder"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function safeEqual(a: string, b: string): boolean { 
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const provided = req.headers.get("x-webhook-secret") ?? "";
  if (!safeEqual(provided, env("WEBHOOK_SECRET"))) return json({ error: "unauthorized" }, 401);

  let payload: { reservation_id?: string; kind?: EmailKind; log_id?: number | string | null };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const { reservation_id, kind } = payload;
  if (!reservation_id || !UUID_RE.test(reservation_id) || !kind || !KINDS.includes(kind)) {
    return json({ error: "invalid_payload" }, 400);
  }
  // Newer databases send the id of this email's email_log row; retries of the same email reuse it.
  const logId = payload.log_id === undefined || payload.log_id === null ? null : Number(payload.log_id);
  if (logId !== null && (!Number.isSafeInteger(logId) || logId <= 0)) return json({ error: "invalid_payload" }, 400);

  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (logId !== null) {
    // Only a row that is still waiting may be sent, so a repeated webhook for an email that already
    // went out (or was skipped or given up on) never reaches the guest twice.
    const { data: row } = await supabase.from("email_log").select("status").eq("id", logId).eq("reservation_id", reservation_id).maybeSingle();
    if (!row) return json({ error: "unknown_log_id" }, 404);
    if (row.status !== "queued") return json({ skipped: true, reason: `already ${row.status}` });
  }

  // The outcome goes on the queued row (newer databases) or into a new row (older ones).
  const log = (status: "sent" | "failed" | "skipped", extra: { provider_id?: string; error?: string } = {}) =>
    logId !== null
      ? supabase.from("email_log").update({ status, ...extra, updated_at: new Date().toISOString() }).eq("id", logId).eq("status", "queued")
      : supabase.from("email_log").insert({ reservation_id, kind, status, ...extra });

  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("id, reference, status, starts_at, ends_at, party_size, large_party, customer_name, email, phone, locale, cancel_reason, token_version, area:areas(name_en, name_bn, branch:branches(name_en, name_bn))")
    .eq("id", reservation_id)
    .single();

  if (error || !reservation) {
    await log("failed", { error: error?.message ?? "reservation not found" });
    return json({ error: "not_found" }, 404);
  }

  // The status may have moved on between enqueue and delivery.
  const expected: Record<EmailKind, string[]> = {
    received: ["pending"],
    waitlist_promoted: ["pending"],
    confirmed: ["confirmed"],
    reminder: ["confirmed"],
    cancelled: ["cancelled", "rejected", "expired"],
  };
  if (!expected[kind].includes(reservation.status)) {
    await log("skipped", { error: `status is ${reservation.status}` });
    return json({ skipped: true });
  }

  const { data: preOrder } = await supabase
    .from("pre_orders")
    .select("id, status")
    .eq("reservation_id", reservation.id)
    .maybeSingle();

  const secret = new TextEncoder().encode(env("RESERVATION_TOKEN_SECRET"));
  const exp = Math.floor(new Date(reservation.ends_at).getTime() / 1000) + 7 * 24 * 3600;
  const token = await new SignJWT({ ver: reservation.token_version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(reservation.id)
    .setAudience("pinewood:reservation")
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret);

  const siteUrl = env("SITE_URL").replace(/\/$/, "");
  const areaRow = Array.isArray(reservation.area) ? reservation.area[0] : reservation.area;
  const area = areaRow ? { ...areaRow, branch: Array.isArray(areaRow.branch) ? (areaRow.branch[0] ?? null) : areaRow.branch } : null;
  const email = renderEmail(kind, { ...reservation, area } as ReservationForEmail, {
    manageUrl: `${siteUrl}/reservation/${token}`,
    siteUrl,
    phone: Deno.env.get("RESTAURANT_PHONE") ?? "+8801914426939",
    hasPreOrder: Boolean(preOrder && preOrder.status !== "cancelled"),
  });

  // One key per email_log row: if a retry of the same row gets through, Resend returns the original
  // result instead of sending again (keys last 24 hours). Older databases: per minute, as before.
  const idempotencyKey = logId !== null ? `pinewood-email-${logId}` : `${reservation.id}-${kind}-${Math.floor(Date.now() / 60_000)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: env("EMAIL_FROM"),
      to: [reservation.email],
      reply_to: Deno.env.get("EMAIL_REPLY_TO") || undefined,
      subject: email.subject,
      html: email.html,
      text: email.text,
      tags: [{ name: "kind", value: kind }],
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    await log("failed", { error: JSON.stringify(result).slice(0, 500) });
    return json({ error: "send_failed" }, 502);
  }

  await log("sent", { provider_id: result.id });
  if (kind === "confirmed") {
    await supabase.from("reservations").update({ confirmation_email_at: new Date().toISOString() }).eq("id", reservation.id);
  }

  return json({ sent: true, id: result.id });
});
