import type { Metadata } from "next";
import { CalendarDays, Clock, MapPin, Phone, Users } from "lucide-react";
import { Container } from "@/components/site/section";
import { PreOrderBuilder, type CartLine } from "@/components/reservation/preorder-builder";
import { CancelRequest } from "@/components/reservation/cancel-request";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMenu } from "@/lib/data";
import { getI18n, pick } from "@/lib/i18n";
import { formatDateLong, formatNumber, formatPrice, formatTime } from "@/lib/format";
import { SITE } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyReservationToken } from "@/lib/tokens";
import type { PreOrderStatus, ReservationStatus } from "@/lib/types";

export const metadata: Metadata = { robots: { index: false, follow: false } };

interface ReservationView {
  id: string;
  reference: string;
  status: ReservationStatus;
  starts_at: string;
  ends_at: string;
  party_size: number;
  large_party: boolean;
  customer_name: string;
  token_version: number;
  cancel_requested_at: string | null;
  area: { name_en: string; name_bn: string; branch_id: string | null } | null;
  // One-to-one embed: PostgREST may return an object or a single-element array.
  pre_orders: PreOrderView[] | PreOrderView | null;
}

interface PreOrderView {
  id: string;
  status: PreOrderStatus;
  notes: string | null;
  total: number;
  pre_order_items: {
    menu_item_id: string | null;
    variant_id: string | null;
    addon_ids: string[];
    item_name: string;
    variant_name: string | null;
    addon_names: string[];
    quantity: number;
    notes: string | null;
    line_total: number;
  }[];
}

async function loadReservation(token: string) {
  // A mangled link (bad percent-encoding) is just an invalid link, not a server error.
  let raw: string;
  try {
    raw = decodeURIComponent(token);
  } catch {
    return null;
  }
  const verified = await verifyReservationToken(raw);
  if (!verified) return null;
  const { data } = await createAdminClient()
    .from("reservations")
    .select(
      "id, reference, status, starts_at, ends_at, party_size, large_party, customer_name, token_version, cancel_requested_at, area:areas(name_en, name_bn, branch_id), pre_orders(id, status, notes, total, pre_order_items(menu_item_id, variant_id, addon_ids, item_name, variant_name, addon_names, quantity, notes, line_total))",
    )
    .eq("id", verified.reservationId)
    .maybeSingle();
  const r = data as unknown as ReservationView | null;
  if (!r || r.token_version !== verified.version) return null;
  return r;
}

export default async function ReservationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [{ locale, t }, reservation] = await Promise.all([getI18n(), loadReservation(token)]);

  if (!reservation) {
    return (
      <Container className="py-24">
        <div className="mx-auto max-w-lg text-center">
          <p className="eyebrow">{t.manage.eyebrow}</p>
          <h1 className="display mt-5 text-4xl text-ink">{t.manage.invalidTitle}</h1>
          <p className="mt-4 text-ink-muted">{t.manage.invalidBody}</p>
          <Button asChild className="mt-8">
            <a href={`tel:${SITE.phones[0].tel}`}>
              <Phone />
              {SITE.phones[0].display}
            </a>
          </Button>
        </div>
      </Container>
    );
  }

  const preOrder = Array.isArray(reservation.pre_orders) ? (reservation.pre_orders[0] ?? null) : reservation.pre_orders;
  const activePreOrder = preOrder && preOrder.status !== "cancelled" ? preOrder : null;
  const beforeCutoff = new Date(reservation.starts_at).getTime() - SITE.booking.preorderCutoffMinutes * 60_000 > Date.now();
  const editableStatus = !activePreOrder || ["submitted", "acknowledged"].includes(activePreOrder.status);
  const canPreOrder = reservation.status === "confirmed" && beforeCutoff && editableStatus;
  const isActive = reservation.status === "pending" || reservation.status === "confirmed";
  const canCancel = isActive && new Date(reservation.starts_at).getTime() > Date.now();

  const menu = canPreOrder ? await getMenu(reservation.area?.branch_id ?? null) : [];
  const initialLines: CartLine[] = (activePreOrder?.pre_order_items ?? [])
    .filter((i) => i.menu_item_id)
    .map((i) => ({
      itemId: i.menu_item_id!,
      variantId: i.variant_id,
      addonIds: i.addon_ids ?? [],
      quantity: i.quantity,
      notes: i.notes ?? "",
    }));

  const statusTone =
    reservation.status === "confirmed" ? "forest" : reservation.status === "pending" ? "gold" : ("neutral" as const);
  const body =
    reservation.status === "pending" ? t.manage.pendingBody : reservation.status === "confirmed" ? t.manage.confirmedBody : t.manage.closedBody;
  const areaName = reservation.area ? pick(reservation.area, "name", locale) : "";

  return (
    <Container className="py-14 lg:py-20">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-14">
        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-sm border border-line bg-surface p-7">
            <p className="eyebrow">{t.manage.eyebrow}</p>
            <h1 className="display mt-4 text-4xl text-ink">{reservation.customer_name}</h1>
            <Badge tone={statusTone} className="mt-4">
              {t.manage.status[reservation.status]}
            </Badge>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">{body}</p>

            <dl className="mt-6 space-y-3 border-t border-line pt-6 text-sm">
              <div className="flex gap-3">
                <dt aria-label={t.manage.date}>
                  <CalendarDays className="size-4 text-accent-ink" />
                </dt>
                <dd>{formatDateLong(reservation.starts_at, locale)}</dd>
              </div>
              <div className="flex gap-3">
                <dt aria-label={t.manage.time}>
                  <Clock className="size-4 text-accent-ink" />
                </dt>
                <dd>
                  {formatTime(reservation.starts_at, locale)} – {formatTime(reservation.ends_at, locale)}
                </dd>
              </div>
              <div className="flex gap-3">
                <dt aria-label={t.manage.guests}>
                  <Users className="size-4 text-accent-ink" />
                </dt>
                <dd>
                  {formatNumber(reservation.party_size, locale)}
                  {reservation.large_party ? "+" : ""}
                </dd>
              </div>
              <div className="flex gap-3">
                <dt aria-label={t.manage.area}>
                  <MapPin className="size-4 text-accent-ink" />
                </dt>
                <dd>{areaName}</dd>
              </div>
            </dl>
            <p className="mt-6 text-xs text-ink-muted">
              {t.manage.reference}: <span className="font-mono font-semibold tracking-wider text-ink">{reservation.reference}</span>
            </p>
          </div>

          {canCancel ? <CancelRequest token={token} alreadyRequested={Boolean(reservation.cancel_requested_at)} /> : null}
        </div>

        <div>
          {reservation.status === "confirmed" ? (
            <>
              <p className="eyebrow">{t.manage.preorderTitle}</p>
              <h2 className="display mt-5 text-4xl text-ink sm:text-5xl">{t.manage.preorderTitle}</h2>
              <p className="mt-4 max-w-xl text-ink-muted">{t.manage.preorderLede}</p>

              {canPreOrder ? (
                <PreOrderBuilder token={token} menu={menu} initialLines={initialLines} initialNotes={activePreOrder?.notes ?? ""} />
              ) : (
                <div className="mt-8 space-y-6">
                  <p className="rounded-sm border border-line bg-surface-2 p-5 text-sm text-ink-muted">
                    {!beforeCutoff ? t.manage.preorderClosed : t.manage.preorderLocked}
                  </p>
                  {activePreOrder ? (
                    <div className="rounded-sm border border-line bg-surface p-6">
                      <p className="eyebrow">{t.manage.currentPreorder}</p>
                      <ul className="mt-4 divide-y divide-line text-sm">
                        {activePreOrder.pre_order_items.map((i, idx) => (
                          <li key={idx} className="flex justify-between gap-4 py-3">
                            <span>
                              {i.quantity} × {i.item_name}
                              {i.variant_name ? <span className="text-ink-muted"> · {i.variant_name}</span> : null}
                              {i.addon_names.length ? <span className="block text-xs text-ink-muted">+ {i.addon_names.join(", ")}</span> : null}
                            </span>
                            <span>{formatPrice(Number(i.line_total), locale)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-4 flex justify-between border-t border-line pt-4 font-semibold">
                        <span>{t.manage.total}</span>
                        <span>{formatPrice(Number(activePreOrder.total), locale)}</span>
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-sm border border-line bg-surface p-8">
              <p className="text-ink-muted">{body}</p>
              <p className="mt-4 text-sm text-ink-muted">
                <a href={`tel:${SITE.phones[0].tel}`} className="inline-flex items-center gap-2 text-ink underline-offset-4 hover:underline">
                  <Phone className="size-4" /> {SITE.phones[0].display}
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
