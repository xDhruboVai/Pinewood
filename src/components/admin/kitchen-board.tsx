"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { setPreOrderStatus } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { EmptyState, Mark, PREORDER_LABEL, PREORDER_TONE, relativeFromNow } from "./ui";
import { parseBookingNotes } from "@/lib/booking-notes";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminPreOrder, PreOrderStatus } from "@/lib/types";

const NEXT: Partial<Record<PreOrderStatus, { to: PreOrderStatus; label: string }>> = {
  submitted: { to: "acknowledged", label: "Acknowledge" },
  acknowledged: { to: "preparing", label: "Start preparing" },
  preparing: { to: "ready", label: "Mark ready" },
  ready: { to: "served", label: "Served" },
};

export function KitchenBoard({ initialDate }: { initialDate: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [date, setDate] = useState(initialDate);
  const [orders, setOrders] = useState<AdminPreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const [branches, setBranches] = useState<Record<string, string>>({});
  const [loadFailed, setLoadFailed] = useState(false);

  // Only the latest load may fill the board (see ReservationsBoard).
  const loadRequest = useRef(0);
  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    const { data, error } = await supabase.rpc("admin_list_pre_orders", { p_from: date, p_to: date });
    if (request !== loadRequest.current) return;
    if (error) console.error("admin_list_pre_orders failed", error);
    setLoadFailed(Boolean(error));
    const list = (data ?? []) as AdminPreOrder[];
    // The branch comes with each order (from the booking's area). Bookings made before branches existed
    // only have it in their notes, which staff can read from reservations (staff-only RLS policy).
    const byReservation: Record<string, string> = {};
    for (const o of list) if (o.reservation.branch) byReservation[o.reservation.id] = o.reservation.branch;
    const legacy = list.filter((o) => !o.reservation.branch);
    if (legacy.length) {
      const { data: notes } = await supabase
        .from("reservations")
        .select("id, special_requests")
        .in("id", legacy.map((o) => o.reservation.id));
      for (const n of (notes ?? []) as { id: string; special_requests: string | null }[]) {
        const branch = parseBookingNotes(n.special_requests).branch;
        if (branch) byReservation[n.id] = branch;
      }
    }
    if (request !== loadRequest.current) return;
    setOrders(list);
    setBranches(byReservation);
    setLoading(false);
  }, [supabase, date]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel("admin-kitchen")
      .on("postgres_changes", { event: "*", schema: "public", table: "pre_orders" }, (payload) => {
        if (payload.eventType === "INSERT") toast("New pre-order received");
        clearTimeout(timer);
        timer = setTimeout(() => loadRef.current(), 300);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reservations" }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => loadRef.current(), 300);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const visible = orders.filter((o) => showDone || !["served", "cancelled"].includes(o.status));
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      if (["served", "cancelled"].includes(o.status)) continue;
      for (const i of o.items) {
        const key = i.variant ? `${i.name} (${i.variant})` : i.name;
        map.set(key, (map.get(key) ?? 0) + i.quantity);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [orders]);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <label className="relative">
          <span className="display text-2xl text-ink sm:text-3xl">{formatDate(`${date}T12:00:00+06:00`, "en", { weekday: "long", month: "long" })}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Date"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-[var(--primary)]" />
          Show served and cancelled
        </label>
      </div>

      {totals.length > 0 ? (
        <section className="rounded-md bg-pine-100 px-6 py-5">
          <h2 className="display text-2xl text-ink">To prepare today</h2>
          <ul className="mt-3 grid gap-x-10 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {totals.map(([name, qty]) => (
              <li key={name} className="flex gap-3">
                <span className="w-7 shrink-0 text-right font-semibold tabular-nums">{qty}×</span>
                <span className="text-ink">{name}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-md bg-surface" />
          ))}
        </div>
      ) : loadFailed ? (
        <div role="alert" className="rounded-md bg-surface px-6 py-10 text-center text-sm text-ink-muted">
          <p className="text-danger">The pre-orders for this day couldn&apos;t be loaded.</p>
          <button type="button" className="mt-3 font-semibold text-primary underline underline-offset-2" onClick={() => { setLoading(true); load(); }}>
            Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState>No pre-orders for this day yet.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((o) => {
            const next = NEXT[o.status];
            const prepBy = new Date(new Date(o.reservation.starts_at).getTime() - 15 * 60_000).toISOString();
            const reservationCancelled = ["cancelled", "rejected", "expired", "no_show"].includes(o.reservation.status);
            return (
              <article
                key={o.id}
                className={cn(
                  "flex flex-col rounded-md p-5",
                  o.status === "submitted" ? "bg-mustard-400/15" : "bg-surface",
                  (o.status === "served" || o.status === "cancelled") && "opacity-60",
                )}
              >
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <p className="display text-4xl leading-none text-ink tabular-nums">{formatTime(o.reservation.starts_at)}</p>
                    {branches[o.reservation.id] ? (
                      <p className="mt-2 text-[0.72rem] font-semibold tracking-[0.12em] text-ink uppercase">{branches[o.reservation.id]}</p>
                    ) : null}
                    <p className="mt-2 text-sm font-semibold text-ink">{o.reservation.customer_name}</p>
                    <p className="text-xs text-ink-muted">
                      {o.reservation.party_size} guests · {o.reservation.area}
                      {o.reservation.tables.length ? ` · ${o.reservation.tables.join(", ")}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 pt-1">
                    <Mark tone={PREORDER_TONE[o.status]}>{PREORDER_LABEL[o.status]}</Mark>
                    <p className="text-xs text-ink-muted">Ready {relativeFromNow(prepBy)}</p>
                  </div>
                </header>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {o.items.map((i) => (
                    <li key={i.id} className="flex gap-3 text-sm">
                      <span className="w-6 shrink-0 text-right font-semibold tabular-nums">{i.quantity}×</span>
                      <span className="min-w-0">
                        <span className="font-medium tracking-wide text-ink uppercase">{i.name}</span>
                        {i.variant ? <span className="text-ink-muted"> · {i.variant}</span> : null}
                        {i.addons.length ? <span className="block text-xs text-ink-muted">With {i.addons.join(", ")}</span> : null}
                        {i.notes ? <span className="block text-xs text-accent-ink">“{i.notes}”</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
                {o.notes ? <p className="mt-4 rounded-md bg-canvas p-3 text-xs text-ink">Note: {o.notes}</p> : null}
                {reservationCancelled ? (
                  <p className="mt-4 text-xs font-semibold text-danger">Booking {o.reservation.status.replace("_", "-")}. Don&apos;t prepare this.</p>
                ) : null}
                <footer className="mt-5 flex items-center justify-between gap-3">
                  <span className="text-xs text-ink-muted tabular-nums">
                    {o.reservation.reference} · {formatPrice(Number(o.total))}
                  </span>
                  {next && !reservationCancelled ? (
                    <Button
                      size="sm"
                      variant="pine"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await setPreOrderStatus(o.id, next.to);
                          if (!res.ok) toast.error(res.error);
                          else load();
                        })
                      }
                    >
                      {next.label}
                    </Button>
                  ) : null}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
