"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChefHat, Clock, Users } from "lucide-react";
import { setPreOrderStatus } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PREORDER_LABEL, relativeFromNow } from "./ui";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminPreOrder, PreOrderStatus } from "@/lib/types";

const NEXT: Partial<Record<PreOrderStatus, { to: PreOrderStatus; label: string }>> = {
  submitted: { to: "acknowledged", label: "Acknowledge" },
  acknowledged: { to: "preparing", label: "Start preparing" },
  preparing: { to: "ready", label: "Mark ready" },
  ready: { to: "served", label: "Served" },
};

const TONE: Record<PreOrderStatus, "gold" | "forest" | "blue" | "neutral" | "danger"> = {
  submitted: "gold",
  acknowledged: "neutral",
  preparing: "blue",
  ready: "forest",
  served: "neutral",
  cancelled: "danger",
};

export function KitchenBoard({ initialDate }: { initialDate: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [date, setDate] = useState(initialDate);
  const [orders, setOrders] = useState<AdminPreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_list_pre_orders", { p_from: date, p_to: date });
    if (error) toast.error(error.message);
    setOrders((data ?? []) as AdminPreOrder[]);
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="h-10 rounded-sm border border-line bg-surface px-3 text-sm"
          aria-label="Date"
        />
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Show served & cancelled
        </label>
      </div>

      {totals.length > 0 ? (
        <section className="rounded-sm border border-line bg-surface p-4">
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Prep totals for the day</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {totals.map(([name, qty]) => (
              <span key={name} className="rounded-sm bg-surface-2 px-2.5 py-1 text-sm">
                <span className="font-semibold tabular-nums">{qty}×</span> {name}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-sm bg-surface-2" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState>
          <ChefHat className="mx-auto mb-3 size-6" />
          No pre-orders for this day yet.
        </EmptyState>
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
                  "flex flex-col rounded-sm border bg-surface",
                  o.status === "submitted" ? "border-gold-400" : o.status === "ready" ? "border-forest-400" : "border-line",
                  (o.status === "served" || o.status === "cancelled") && "opacity-60",
                )}
              >
                <header className="flex items-start justify-between gap-3 border-b border-line p-4">
                  <div>
                    <p className="font-display text-3xl leading-none text-ink tabular-nums">{formatTime(o.reservation.starts_at)}</p>
                    <p className="mt-1.5 text-sm font-semibold text-ink">{o.reservation.customer_name}</p>
                    <p className="flex items-center gap-2 text-xs text-ink-muted">
                      <Users className="size-3" /> {o.reservation.party_size} · {o.reservation.area}
                      {o.reservation.tables.length ? ` · ${o.reservation.tables.join(", ")}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge tone={TONE[o.status]}>{PREORDER_LABEL[o.status]}</Badge>
                    <p className="mt-2 flex items-center justify-end gap-1 text-xs text-ink-muted">
                      <Clock className="size-3" /> ready {relativeFromNow(prepBy)}
                    </p>
                  </div>
                </header>
                <ul className="flex-1 divide-y divide-line px-4">
                  {o.items.map((i) => (
                    <li key={i.id} className="py-2.5 text-sm">
                      <span className="font-semibold tabular-nums">{i.quantity}×</span> {i.name}
                      {i.variant ? <span className="text-ink-muted"> · {i.variant}</span> : null}
                      {i.addons.length ? <span className="block pl-6 text-xs text-ink-muted">+ {i.addons.join(", ")}</span> : null}
                      {i.notes ? <span className="block pl-6 text-xs text-gold-600 italic">“{i.notes}”</span> : null}
                    </li>
                  ))}
                </ul>
                {o.notes ? <p className="mx-4 mb-3 rounded-sm bg-surface-2 p-2.5 text-xs text-ink">Note: {o.notes}</p> : null}
                {reservationCancelled ? (
                  <p className="mx-4 mb-3 text-xs font-semibold text-red-800">Reservation {o.reservation.status.replace("_", "-")} — do not prepare.</p>
                ) : null}
                <footer className="flex items-center justify-between gap-3 border-t border-line p-4">
                  <span className="text-sm text-ink-muted">
                    {o.reservation.reference} · {formatPrice(Number(o.total))}
                  </span>
                  {next && !reservationCancelled ? (
                    <Button
                      size="sm"
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
