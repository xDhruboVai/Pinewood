"use server";

import { createHash, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { errorKey, reservationSchema, slotSchema, waitlistSchema } from "@/lib/validation";
import type { z } from "zod";

export type FormResult<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

const CLIENT_COOKIE = "pw-bid";

async function clientIdentity() {
  const store = await cookies();
  let key = store.get(CLIENT_COOKIE)?.value;
  if (!key || !/^[0-9a-f-]{36}$/.test(key)) {
    key = randomUUID();
    store.set(CLIENT_COOKIE, key, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const ipHash = createHash("sha256")
    .update(`${ip}:${process.env.RESERVATION_TOKEN_SECRET ?? ""}`)
    .digest("hex")
    .slice(0, 32);
  return { clientKey: key, ipHash };
}

function fieldErrors(error: z.ZodError): FormResult<never> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = String(issue.path[0] ?? "");
    if (path && !fields[path]) fields[path] = issue.message.startsWith("invalid") || issue.message === "consentRequired" ? issue.message : "generic";
  }
  return { ok: false, error: Object.values(fields)[0] ?? "generic", fields };
}

export async function holdSlot(input: unknown): Promise<FormResult<{ holdId: string; expiresAt: string }>> {
  const parsed = slotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "PW_INVALID_SLOT" };

  const { clientKey, ipHash } = await clientIdentity();
  const { data, error } = await createAdminClient().rpc("hold_slot", {
    p_area: parsed.data.areaId,
    p_start: parsed.data.start,
    p_duration_minutes: parsed.data.duration,
    p_party_size: parsed.data.partySize,
    p_client_key: clientKey,
    p_ip_hash: ipHash,
  });
  if (error) return { ok: false, error: errorKey(error) };

  const row = (Array.isArray(data) ? data[0] : data) as { hold_id: string; expires_at: string } | undefined;
  if (!row) return { ok: false, error: "generic" };
  return { ok: true, data: { holdId: row.hold_id, expiresAt: row.expires_at } };
}

export async function releaseHold(holdId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(holdId)) return;
  const { clientKey } = await clientIdentity();
  await createAdminClient().rpc("release_hold", { p_hold_id: holdId, p_client_key: clientKey });
}

export async function submitReservation(input: unknown): Promise<FormResult<{ reference: string; phone: string }>> {
  const parsed = reservationSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  if (d.website) return { ok: true, data: { reference: "PW-------", phone: d.phone } };

  const { clientKey } = await clientIdentity();
  const { data, error } = await createAdminClient().rpc("create_reservation", {
    p_hold_id: d.holdId,
    p_client_key: clientKey,
    p_name: d.name,
    p_phone: d.phone,
    p_email: d.email,
    p_requests: d.requests,
    p_large_party: d.largeParty,
    p_locale: d.locale,
  });
  if (error) return { ok: false, error: errorKey(error) };

  const row = (Array.isArray(data) ? data[0] : data) as { reservation_id: string; reference: string } | undefined;
  if (!row) return { ok: false, error: "generic" };
  return { ok: true, data: { reference: row.reference, phone: d.phone } };
}

export async function joinWaitlist(input: unknown): Promise<FormResult<{ id: string }>> {
  const parsed = waitlistSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  if (d.website) return { ok: true, data: { id: "" } };

  const { data, error } = await createAdminClient().rpc("join_waitlist", {
    p_area: d.areaId,
    p_start: d.start,
    p_duration_minutes: d.duration,
    p_party_size: d.partySize,
    p_name: d.name,
    p_phone: d.phone,
    p_email: d.email,
    p_large_party: d.largeParty,
    p_locale: d.locale,
  });
  if (error) return { ok: false, error: errorKey(error) };
  return { ok: true, data: { id: String(data) } };
}
