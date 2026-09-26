"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { deleteReservation, resendEmail, setReservationStatus } from "@/actions/admin";
import { PREORDER_LABEL } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { parseBookingNotes } from "@/lib/booking-notes";
import { createClient } from "@/lib/supabase/client";
import { dhakaDate, formatDate, formatPrice, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminReservation, ReservationStatus } from "@/lib/types";

// A working screen, so one typeface (the site's sans) at a few sizes; the serif is kept for the page
// title only. Rows: time on the left, the guest and the booking in the middle, the state and what
// staff can do on the right. On phones they stack: time, guest, then the actions.
const ROW = "grid grid-cols-1 gap-y-2 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:gap-x-8";
const TIME = "text-[1.0625rem] leading-6 font-semibold whitespace-nowrap tabular-nums";
const NAME = "text-[1.0625rem] leading-6 font-semibold break-words";
const LINK_ACTION = "text-sm font-medium whitespace-nowrap text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline disabled:opacity-50";
const ICON_BUTTON =
  "inline-flex size-9 items-center justify-center text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mustard-400";

// Bookings that are over: shown quietly, and a manager may delete them.
const CLOSED: ReservationStatus[] = ["rejected", "cancelled", "expired", "no_show"];

type Filter = "all" | "pending" | "confirmed" | "declined" | "cancelled";
const FILTERS: { key: Filter; label: string; statuses?: ReservationStatus[] }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending", statuses: ["pending"] },
  { key: "confirmed", label: "Confirmed", statuses: ["confirmed", "seated", "completed"] },
  { key: "declined", label: "Declined", statuses: ["rejected"] },
  { key: "cancelled", label: "Cancelled", statuses: ["cancelled", "expired"] },
];

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00+06:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d);
}

/** "Today", "Tomorrow", "In 12 days", "3 days ago": where the chosen day sits from today in Dhaka. */
function relativeDay(date: string) {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${dhakaDate()}T00:00:00Z`)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

export function ReservationsBoard({ initialDate, canDelete = false }: { initialDate: string; canDelete?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [date, setDate] = useState(initialDate);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [rows, setRows] = useState<AdminReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  // Only the latest load may fill the board: flicking through days quickly, a slower answer for an
  // earlier day is dropped instead of showing that day's bookings under the new date.
  const loadRequest = useRef(0);
  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    const res = await supabase.rpc("admin_list_reservations", { p_from: date, p_to: date });
    if (request !== loadRequest.current) return;
    // Say plainly that the list didn't load (not "no bookings"); the details go to the console.
    if (res.error) console.error("admin_list_reservations failed", res.error);
    setLoadFailed(Boolean(res.error));
    setRows((res.data ?? []) as AdminReservation[]);
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
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => loadRef.current(), 300);
    };
    const channel = supabase
      .channel("admin-reservations")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reservations" }, (payload) => {
        const r = payload.new as { customer_name?: string; party_size?: number };
        toast(`New request: ${r.customer_name ?? "Guest"} · ${r.party_size ?? "?"} guests`);
        refresh();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reservations" }, refresh)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "reservations" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "pre_orders" }, refresh)
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const q = query.trim().toLowerCase();
  const matching = rows.filter(
    (r) =>
      !q || r.customer_name.toLowerCase().includes(q) || r.phone.includes(q) || r.reference.toLowerCase().includes(q) || r.email.includes(q),
  );
  const inFilter = (r: AdminReservation, key: Filter) => {
    const statuses = FILTERS.find((f) => f.key === key)?.statuses;
    return !statuses || statuses.includes(r.status);
  };
  const visible = matching.filter((r) => inFilter(r, filter));
  const confirmed = rows.filter((r) => ["confirmed", "seated", "completed"].includes(r.status));
  const covers = confirmed.reduce((s, r) => s + r.party_size, 0);
  const toCall = rows.filter((r) => r.status === "pending").length;
  const isToday = date === dhakaDate();
  const filterLabel = FILTERS.find((f) => f.key === filter)!.label.toLowerCase();

  return (
    <div>
      {/* The day and search */}
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex divide-x divide-line rounded-sm border border-line bg-surface">
            <button type="button" aria-label="Previous day" className={ICON_BUTTON} onClick={() => setDate((d) => shiftDate(d, -1))}>
              <ChevronLeft className="size-4" strokeWidth={1.75} />
            </button>
            <button type="button" aria-label="Next day" className={ICON_BUTTON} onClick={() => setDate((d) => shiftDate(d, 1))}>
              <ChevronRight className="size-4" strokeWidth={1.75} />
            </button>
          </div>
          <label className="relative flex items-baseline gap-3 rounded-sm focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-mustard-400">
            <span className="text-xl font-semibold text-ink sm:text-[1.375rem]">
              {formatDate(`${date}T12:00:00+06:00`, "en", { weekday: "long", month: "long" })}
            </span>
            <span className={cn("text-sm", isToday ? "font-medium text-accent-ink" : "text-ink-muted")}>{relativeDay(date)}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Date"
            />
          </label>
          {!isToday ? (
            <Button variant="ghost" className="h-9 border border-line px-3 text-sm font-medium" onClick={() => setDate(dhakaDate())}>
              Today
            </Button>
          ) : null}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.5} />
          <Input
            aria-label="Search bookings"
            placeholder="Name, phone or reference"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 rounded-sm pl-10 text-sm"
          />
        </div>
      </div>

      {/* Filters and the day's numbers, on one ruled line */}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-2 border-b border-line">
        <div role="group" aria-label="Show bookings" className="-mb-px flex flex-wrap gap-x-6">
          {FILTERS.map((f) => {
            const count = rows.filter((r) => inFilter(r, f.key)).length;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                aria-label={`${f.label}, ${count}`}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "inline-flex items-center gap-2 border-b-2 pt-1 pb-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mustard-400",
                  active ? "border-mustard-400 text-ink" : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 text-center text-xs leading-5 tabular-nums",
                    active ? "bg-pine-700 text-cream-50" : "bg-ink/[0.06] text-ink-muted",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <p className="pb-2.5 text-sm text-ink-muted tabular-nums">
          {rows.length} {rows.length === 1 ? "booking" : "bookings"} · {confirmed.length} confirmed · {covers} {covers === 1 ? "guest" : "guests"} expected
          {toCall ? <span className="font-medium text-accent-ink"> · {toCall} to call</span> : null}
        </p>
      </div>

      {loading ? (
        <div className="divide-y divide-line">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse bg-surface/60" />
          ))}
        </div>
      ) : loadFailed ? (
        <div role="alert" className="border-b border-line py-16 text-center text-sm text-ink-muted">
          <p className="text-danger">The bookings for this day couldn&apos;t be loaded.</p>
          <button type="button" className="mt-3 font-semibold text-primary underline underline-offset-2" onClick={() => { setLoading(true); load(); }}>
            Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <p className="border-b border-line py-16 text-center text-sm text-ink-muted">
          {q && matching.length === 0
            ? `No bookings match "${query.trim()}".`
            : rows.length === 0
              ? "No bookings for this day."
              : `No ${filterLabel} bookings${q ? ` match "${query.trim()}"` : " for this day"}.`}
        </p>
      ) : (
        <ul>
          {visible.map((r) => (
            <ReservationRow key={r.id} r={r} canDelete={canDelete} onChanged={load} />
          ))}
        </ul>
      )}
    </div>
  );
}

// What each state is called, and its dot.
const STATE: Record<ReservationStatus, { label: string; dot: string; text: string }> = {
  pending: { label: "Awaiting call", dot: "bg-mustard-400", text: "text-ink" },
  confirmed: { label: "Confirmed", dot: "bg-pine-600", text: "text-ink" },
  seated: { label: "Seated", dot: "bg-pine-600", text: "text-ink" },
  completed: { label: "Completed", dot: "bg-ink/30", text: "text-ink-muted" },
  cancelled: { label: "Cancelled", dot: "bg-danger", text: "text-danger" },
  rejected: { label: "Declined", dot: "bg-danger", text: "text-danger" },
  expired: { label: "Not confirmed", dot: "bg-ink/30", text: "text-ink-muted" },
  no_show: { label: "No-show", dot: "bg-danger", text: "text-danger" },
};

function StateLabel({ status, label }: { status: ReservationStatus; label?: string }) {
  const s = STATE[status];
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm font-medium whitespace-nowrap", s.text)}>
      <span aria-hidden className={cn("size-2 rounded-full", s.dot)} />
      {label ?? s.label}
    </span>
  );
}

/**
 * One booking. The time and the guest's name lead; people, phone, email, reference, branch, seating
 * and the guest's note sit under the name. On the right: a new booking can be confirmed or declined,
 * a confirmed one cancelled, and a finished one deleted by a manager. If the guest asked to cancel
 * (through the link in their email), the action is "Approve cancel".
 */
function ReservationRow({ r, canDelete, onChanged }: { r: AdminReservation; canDelete: boolean; onChanged: () => void }) {
  const [pending, startTransition] = useTransition();

  const change = (status: ReservationStatus, success: string, ask?: string) => {
    if (ask && !window.confirm(ask)) return;
    startTransition(async () => {
      const res = await setReservationStatus(r.id, status);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(success);
        onChanged();
      }
    });
  };

  const resend = () =>
    startTransition(async () => {
      const res = await resendEmail(r.id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Email sent again");
        onChanged();
      }
    });

  const remove = () => {
    if (!window.confirm(`Delete ${r.customer_name}'s ${STATE[r.status].label.toLowerCase()} booking (${r.reference}) for good? Its email history goes with it. This can't be undone.`)) return;
    startTransition(async () => {
      const res = await deleteReservation(r.id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Booking deleted");
        onChanged();
      }
    });
  };

  const cancelRequested = Boolean(r.cancel_requested_at) && ["pending", "confirmed"].includes(r.status);
  const closed = CLOSED.includes(r.status);
  // What the guest asked for. The branch is data on the booking's area; bookings made before branches
  // existed only have it in the notes. Seating preference and the guest's note come from the notes.
  const notes = parseBookingNotes(r.special_requests);
  const branch = r.branch?.name ?? notes.branch;
  const { seating, note } = notes;
  const preOrder = r.pre_order && r.pre_order.status !== "cancelled" ? r.pre_order : null;
  // The latest email didn't reach the guest: it failed, or got no answer for 15 minutes.
  const mail = r.last_email;
  const emailProblem =
    ["pending", "confirmed"].includes(r.status) &&
    !!mail &&
    (mail.status === "failed" || (mail.status === "queued" && Date.now() - new Date(mail.at).getTime() > 15 * 60_000));

  return (
    <li className="border-b border-line">
      <div className={cn(ROW, "py-5")}>
        <span className={cn(TIME, closed ? "text-ink-muted" : "text-ink")}>{formatTime(r.starts_at)}</span>

        <div className="min-w-0">
          <p className={cn(NAME, closed ? "text-ink-muted" : "text-ink")}>{r.customer_name}</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-ink-muted">
            <span className="text-ink">
              {r.party_size}
              {r.large_party ? "+" : ""} {r.party_size === 1 ? "guest" : "guests"}
            </span>
            <span aria-hidden>·</span>
            <a href={`tel:${r.phone}`} className="font-medium text-primary tabular-nums hover:underline">
              {r.phone.replace(/^\+88/, "")}
            </a>
            <span aria-hidden>·</span>
            <a href={`mailto:${r.email}`} className="min-w-0 break-all hover:text-ink hover:underline">
              {r.email}
            </a>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{r.reference}</span>
          </p>
          {branch || seating ? <p className="mt-1.5 text-sm text-ink">{[branch, seating].filter(Boolean).join(" · ")}</p> : null}
          {note ? (
            <p className="mt-2 max-w-2xl border-l-2 border-line pl-3 text-sm leading-relaxed whitespace-pre-line text-ink-muted">“{note}”</p>
          ) : null}
          {preOrder ? (
            <p className="mt-2 text-sm font-medium text-primary tabular-nums">
              Pre-order: {preOrder.item_count} {preOrder.item_count === 1 ? "item" : "items"} · {formatPrice(Number(preOrder.total))} ·{" "}
              {PREORDER_LABEL[preOrder.status]}
            </p>
          ) : null}
          {emailProblem ? (
            <p className="mt-2 text-sm text-danger">
              The {mail!.kind.replace("_", " ")} email didn&apos;t reach the guest.{" "}
              <button type="button" className="font-semibold underline underline-offset-2 disabled:opacity-50" disabled={pending} onClick={resend}>
                Resend
              </button>
            </p>
          ) : null}
        </div>

        {/* State first, then what can be done about it */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 sm:flex-col sm:items-end sm:gap-y-2.5 sm:pt-0.5">
          {cancelRequested ? (
            <>
              <StateLabel status="cancelled" label="Asked to cancel" />
              <Button
                variant="danger"
                className="h-9 px-4 text-sm normal-case tracking-normal"
                disabled={pending}
                onClick={() => change("cancelled", "Cancelled, guest emailed", "Cancel this booking? The guest will get an email.")}
              >
                Approve cancel
              </Button>
            </>
          ) : r.status === "pending" ? (
            <>
              <StateLabel status="pending" />
              <div className="flex items-center gap-x-4">
                <Button variant="pine" className="h-9 px-5 text-sm normal-case tracking-normal" disabled={pending} onClick={() => change("confirmed", "Confirmed, guest emailed")}>
                  Confirm
                </Button>
                <button
                  type="button"
                  className={LINK_ACTION}
                  disabled={pending}
                  onClick={() => change("rejected", "Declined, guest emailed", "Decline this booking? The guest will get an email.")}
                >
                  Decline
                </button>
              </div>
            </>
          ) : r.status === "confirmed" ? (
            <>
              <StateLabel status="confirmed" />
              {/* For a guest who phones to cancel. Unlike Decline (a request we turn down), this cancels a
                  booking we had confirmed; the seats are freed and the guest is emailed. */}
              <button
                type="button"
                className={cn(LINK_ACTION, "hover:text-danger")}
                disabled={pending}
                onClick={() =>
                  change(
                    "cancelled",
                    "Booking cancelled, guest emailed",
                    `Cancel ${r.customer_name}'s confirmed booking at ${formatTime(r.starts_at)}? The table is freed and the guest gets a cancellation email. This can't be undone.`,
                  )
                }
              >
                Cancel booking
              </button>
            </>
          ) : (
            <>
              <StateLabel status={r.status} />
              {closed && canDelete ? (
                <button type="button" className={cn(LINK_ACTION, "hover:text-danger")} disabled={pending} onClick={remove}>
                  Delete
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </li>
  );
}
