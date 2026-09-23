"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { verifyReservationToken } from "@/lib/tokens";
import { errorKey, preOrderSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

async function resolveReservation(token: string) {
  const verified = await verifyReservationToken(token);
  if (!verified) return null;
  const { data } = await createAdminClient()
    .from("reservations")
    .select("id, token_version")
    .eq("id", verified.reservationId)
    .maybeSingle();
  if (!data || data.token_version !== verified.version) return null;
  return data.id as string;
}

export async function savePreOrder(input: unknown): Promise<ActionResult<{ total: number }>> {
  const parsed = preOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "PW_INVALID_ITEMS" };

  const reservationId = await resolveReservation(parsed.data.token);
  if (!reservationId) return { ok: false, error: "invalidLink" };

  const items = parsed.data.items.map((i) => ({
    item_id: i.item_id,
    variant_id: i.variant_id ?? null,
    addon_ids: i.addon_ids,
    quantity: i.quantity,
    notes: i.notes,
  }));

  const admin = createAdminClient();
  const { data: preOrderId, error } = await admin.rpc("upsert_pre_order", {
    p_reservation: reservationId,
    p_items: items,
    p_notes: parsed.data.notes,
  });
  if (error) return { ok: false, error: errorKey(error) };

  if (!preOrderId) return { ok: true, data: { total: 0 } };
  const { data } = await admin.from("pre_orders").select("total").eq("id", preOrderId).single();
  return { ok: true, data: { total: Number(data?.total ?? 0) } };
}

export async function requestCancellation(token: string): Promise<ActionResult> {
  const reservationId = await resolveReservation(token);
  if (!reservationId) return { ok: false, error: "invalidLink" };
  const { error } = await createAdminClient().rpc("request_cancellation", { p_reservation: reservationId });
  if (error) return { ok: false, error: errorKey(error) };
  return { ok: true, data: undefined };
}
