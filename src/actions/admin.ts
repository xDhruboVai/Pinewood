"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getStaff, type StaffSession } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { dhakaToIso } from "@/lib/format";
import type { ActionResult, PreOrderStatus, ReservationStatus, StaffRole } from "@/lib/types";

const uuid = z.string().uuid();

const GENERIC = "Something went wrong. Please try again.";
const FRIENDLY: Record<string, string> = {
  PW_FORBIDDEN: "You don't have permission to do that.",
  PW_INVALID_TRANSITION: "That status change isn't allowed from the current status.",
  PW_SLOT_FULL: "The 24h hold lapsed and the seats have been taken. Offer another time or add capacity.",
  PW_NOT_FOUND: "Reservation not found.",
};

/** A database or auth error as a message for staff. Only known PW_ codes are shown; anything else
 *  (a raw database or network message) goes to the server log and staff see a plain message. */
function fail(error: { message?: string } | null | undefined): ActionResult {
  const msg = error?.message ?? "";
  const code = msg.match(/PW_[A-Z_]+/)?.[0];
  if (code && FRIENDLY[code]) return { ok: false, error: FRIENDLY[code] };
  console.error("admin action failed:", msg || error);
  return { ok: false, error: GENERIC };
}

/**
 * The signed-in staff member, or the message the screen should show. Returned, not thrown, so an
 * expired session shows "please sign in again" instead of breaking the page.
 */
async function staffCheck(managerOnly = false): Promise<{ ok: true; staff: StaffSession } | { ok: false; error: string }> {
  const staff = await getStaff();
  if (!staff) return { ok: false, error: "Your session has ended. Please sign in again." };
  if (managerOnly && staff.role !== "manager") return { ok: false, error: "Only managers can do that." };
  return { ok: true, staff };
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------
const STATUSES: ReservationStatus[] = ["pending", "confirmed", "seated", "completed", "cancelled", "rejected", "expired", "no_show"];

export async function setReservationStatus(id: string, status: ReservationStatus, reason?: string): Promise<ActionResult> {
  const auth = await staffCheck();
  if (!auth.ok) return auth;
  if (!uuid.safeParse(id).success || !STATUSES.includes(status)) return { ok: false, error: "Invalid request" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_status", { p_id: id, p_status: status, p_reason: reason?.slice(0, 300) ?? null });
  return error ? fail(error) : { ok: true, data: undefined };
}

export async function dismissCancelRequest(id: string): Promise<ActionResult> {
  const auth = await staffCheck();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_dismiss_cancel_request", { p_id: id });
  return error ? fail(error) : { ok: true, data: undefined };
}

export async function updateStaffNotes(id: string, notes: string): Promise<ActionResult> {
  const auth = await staffCheck();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_notes", { p_id: id, p_notes: notes.slice(0, 1000) });
  return error ? fail(error) : { ok: true, data: undefined };
}

export async function assignTables(id: string, tableIds: string[]): Promise<ActionResult> {
  const auth = await staffCheck();
  if (!auth.ok) return auth;
  if (!z.array(uuid).max(20).safeParse(tableIds).success) return { ok: false, error: "Invalid tables" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_assign_tables", { p_id: id, p_table_ids: tableIds });
  return error ? fail(error) : { ok: true, data: undefined };
}

export async function resendEmail(id: string): Promise<ActionResult> {
  const auth = await staffCheck();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_resend_email", { p_id: id });
  return error ? fail(error) : { ok: true, data: undefined };
}

export async function setWaitlistStatus(id: string, status: "cancelled" | "waiting"): Promise<ActionResult> {
  const auth = await staffCheck();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { error } = await supabase.from("waitlist_entries").update({ status }).eq("id", id);
  return error ? fail(error) : { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Kitchen
// ---------------------------------------------------------------------------
export async function setPreOrderStatus(id: string, status: PreOrderStatus): Promise<ActionResult> {
  const auth = await staffCheck();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_pre_order_status", { p_id: id, p_status: status });
  return error ? fail(error) : { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------
const blockoutSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  from: z.string().regex(/^\d{2}:\d{2}$/),
  to: z.string().regex(/^\d{2}:\d{2}$/),
  areaId: z.union([uuid, z.literal("")]),
  seats: z.coerce.number().int().min(0).max(200),
  reason: z.string().trim().min(1).max(120),
});

export async function createBlockout(input: unknown): Promise<ActionResult> {
  const auth = await staffCheck();
  if (!auth.ok) return auth;
  const parsed = blockoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the blockout details." };
  const d = parsed.data;
  const starts = dhakaToIso(d.date, d.from);
  const ends = dhakaToIso(d.date, d.to);
  if (new Date(ends) <= new Date(starts)) return { ok: false, error: "End time must be after start time." };

  const supabase = await createClient();
  const { error } = await supabase.from("blockouts").insert({
    area_id: d.areaId || null,
    starts_at: starts,
    ends_at: ends,
    seats: d.areaId && d.seats > 0 ? d.seats : null,
    reason: d.reason,
  });
  if (error) return fail(error);
  revalidatePath("/admin/availability");
  return { ok: true, data: undefined };
}

export async function deleteBlockout(id: string): Promise<ActionResult> {
  const auth = await staffCheck();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { error } = await supabase.from("blockouts").delete().eq("id", id);
  if (error) return fail(error);
  revalidatePath("/admin/availability");
  return { ok: true, data: undefined };
}

export async function toggleArea(id: string, isActive: boolean): Promise<ActionResult> {
  const auth = await staffCheck(true);
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { error } = await supabase.from("areas").update({ is_active: isActive }).eq("id", id);
  if (error) return fail(error);
  updateTag(CACHE_TAGS.areas);
  revalidatePath("/admin/availability");
  return { ok: true, data: undefined };
}

export async function toggleTable(id: string, isActive: boolean): Promise<ActionResult> {
  const auth = await staffCheck(true);
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { error } = await supabase.from("dining_tables").update({ is_active: isActive }).eq("id", id);
  if (error) return fail(error);
  revalidatePath("/admin/availability");
  return { ok: true, data: undefined };
}

const overrideSchema = z.object({
  label: z.string().trim().min(2).max(80),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isClosed: z.boolean(),
  opensAt: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  closesAt: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
});

export async function createHoursOverride(input: unknown): Promise<ActionResult> {
  const auth = await staffCheck(true);
  if (!auth.ok) return auth;
  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the override details." };
  const d = parsed.data;
  if (d.endsOn < d.startsOn) return { ok: false, error: "End date must be on or after the start date." };
  if (!d.isClosed && (!d.opensAt || !d.closesAt)) return { ok: false, error: "Opening and closing times are required." };

  const supabase = await createClient();
  const { error } = await supabase.from("hours_overrides").insert({
    label: d.label,
    starts_on: d.startsOn,
    ends_on: d.endsOn,
    is_closed: d.isClosed,
    opens_at: d.isClosed ? null : d.opensAt,
    closes_at: d.isClosed ? null : d.closesAt,
  });
  if (error) return fail(error);
  updateTag(CACHE_TAGS.hours);
  revalidatePath("/admin/availability");
  return { ok: true, data: undefined };
}

export async function deleteHoursOverride(id: string): Promise<ActionResult> {
  const auth = await staffCheck(true);
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { error } = await supabase.from("hours_overrides").delete().eq("id", id);
  if (error) return fail(error);
  updateTag(CACHE_TAGS.hours);
  revalidatePath("/admin/availability");
  return { ok: true, data: undefined };
}

export async function updateOpeningHours(weekday: number, opensAt: string, closesAt: string, isClosed: boolean): Promise<ActionResult> {
  const auth = await staffCheck(true);
  if (!auth.ok) return auth;
  if (weekday < 0 || weekday > 6) return { ok: false, error: "Invalid day" };
  if (!isClosed && (!/^\d{2}:\d{2}$/.test(opensAt) || !/^\d{2}:\d{2}$/.test(closesAt))) return { ok: false, error: "Invalid times" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("opening_hours")
    .update({ opens_at: isClosed ? null : opensAt, closes_at: isClosed ? null : closesAt, is_closed: isClosed })
    .eq("weekday", weekday)
    // The hours every branch shares; a branch's own hours are separate rows (migration 20260926000100).
    .is("branch_id", null);
  if (error) return fail(error);
  updateTag(CACHE_TAGS.hours);
  revalidatePath("/admin/availability");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
export async function updateMenuItem(
  id: string,
  patch: { is_available?: boolean; is_featured?: boolean; price?: number },
): Promise<ActionResult> {
  const auth = await staffCheck(true);
  if (!auth.ok) return auth;
  if (!patch || typeof patch !== "object") return { ok: false, error: "Invalid request" };
  const clean: Record<string, unknown> = {};
  if (typeof patch.is_available === "boolean") clean.is_available = patch.is_available;
  if (typeof patch.is_featured === "boolean") clean.is_featured = patch.is_featured;
  // A dish always costs something (no menu item is priced at 0), so an empty or zero price is a
  // mistake, never "free". Anything that isn't a real number above 0 is refused, not coerced.
  if ("price" in patch) {
    const price = patch.price;
    const cents = typeof price === "number" ? price * 100 : NaN;
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0 || price > 100000 || Math.abs(Math.round(cents) - cents) > 1e-6) {
      return { ok: false, error: "Enter a price above ৳0 (up to ৳100,000, at most 2 decimals)." };
    }
    clean.price = Math.round(cents) / 100;
  }
  if (Object.keys(clean).length === 0) return { ok: false, error: "Nothing to update." };
  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").update(clean).eq("id", id);
  if (error) return fail(error);
  // The public menu is cached (src/lib/data.ts): expire it so the next page view reads the change.
  updateTag(CACHE_TAGS.menu);
  revalidatePath("/menu");
  revalidatePath("/");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------
const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  fullName: z.string().trim().min(2).max(80),
  role: z.enum(["manager", "foh"]),
});

export async function inviteStaff(input: unknown): Promise<ActionResult> {
  const auth = await staffCheck(true);
  if (!auth.ok) return auth;
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please enter a name, a valid email and a role." };

  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/admin/login?invited=1`,
    data: { full_name: parsed.data.fullName },
  });
  if (error || !data.user) return fail(error);

  const { error: profileError } = await admin
    .from("staff_profiles")
    .upsert({ user_id: data.user.id, full_name: parsed.data.fullName, role: parsed.data.role, is_active: true });
  if (profileError) return fail(profileError);

  revalidatePath("/admin/staff");
  return { ok: true, data: undefined };
}

export async function updateStaffMember(userId: string, patch: { role?: StaffRole; is_active?: boolean }): Promise<ActionResult> {
  const auth = await staffCheck(true);
  if (!auth.ok) return auth;
  const me = auth.staff;
  if (userId === me.userId) return { ok: false, error: "You can't change your own role or access." };
  const clean: Record<string, unknown> = {};
  if (patch.role === "manager" || patch.role === "foh") clean.role = patch.role;
  if (typeof patch.is_active === "boolean") clean.is_active = patch.is_active;
  const supabase = await createClient();
  const { error } = await supabase.from("staff_profiles").update(clean).eq("user_id", userId);
  if (error) return fail(error);
  revalidatePath("/admin/staff");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
