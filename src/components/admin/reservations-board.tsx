"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Armchair,
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock,
  Ellipsis,
  Eye,
  Inbox,
  MapPin,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { deleteReservation, resendEmail, setReservationStatus } from "@/actions/admin";
import { PREORDER_LABEL } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { parseBookingNotes } from "@/lib/booking-notes";
import { createClient } from "@/lib/supabase/client";
import { dhakaDate, formatDate, formatPrice, formatTime, isoToDhakaDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminReservation, ReservationStatus } from "@/lib/types";

// The register. From 1280px a row is five columns (time, guest, details, status, actions) under a
// heading row; below that the same parts stack: time and status on one line, then the guest, the
// details and the actions. One layout in the DOM, rearranged with grid areas.
const ROW_GRID = cn(
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-4 [grid-template-areas:'time_status'_'guest_guest'_'details_details'_'actions_actions']",
  "xl:grid-cols-[7.5rem_minmax(0,1fr)_minmax(0,1.15fr)_11rem_13.5rem] xl:gap-x-8 xl:[grid-template-areas:'time_guest_details_status_actions']",
);
const ICON = "size-4 shrink-0 text-ink-muted";
const CAPS = "text-[0.7rem] font-semibold tracking-[0.12em] uppercase";
// Controls that are words, not boxes: small capitals, like the labels on the public booking form.
const TEXT_ACTION = "text-[0.72rem] font-semibold tracking-[0.12em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mustard-400";
const ICON_BUTTON =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-mustard-400";

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

// How each state reads: a small icon and the word in the state's colour (no badge), and the colour of
// the row's thin left rule.
type Tone = "gold" | "teal" | "red" | "muted";
const STATUS: Record<ReservationStatus, { label: string; icon: LucideIcon; tone: Tone }> = {
  pending: { label: "Pending", icon: Clock, tone: "gold" },
  confirmed: { label: "Confirmed", icon: CircleCheck, tone: "teal" },
  seated: { label: "Seated", icon: Armchair, tone: "teal" },
  completed: { label: "Completed", icon: CircleCheck, tone: "muted" },
  cancelled: { label: "Cancelled", icon: Ban, tone: "muted" },
  rejected: { label: "Declined", icon: CircleX, tone: "red" },
  expired: { label: "Not confirmed", icon: Clock, tone: "muted" },
  no_show: { label: "No-show", icon: CircleX, tone: "red" },
};
const TONE_TEXT: Record<Tone, string> = {
  gold: "text-accent-ink",
  teal: "text-pine-700",
  red: "text-danger",
  muted: "text-ink-muted",
};
const TONE_RULE: Record<Tone, string> = {
  gold: "before:bg-mustard-400",
  teal: "before:bg-pine-600",
  red: "before:bg-danger/60",
  muted: "before:bg-line",
};

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

/** "26 Sep, 2:45 pm" in Dhaka time. */
function stamp(iso: string) {
  return `${formatDate(iso, "en", { weekday: undefined, day: "numeric", month: "short" })}, ${formatTime(iso)}`;
}

export function ReservationsBoard({ initialDate, canDelete = false }: { initialDate: string; canDelete?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [date, setDate] = useState(initialDate);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [rows, setRows] = useState<AdminReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxRows, setInboxRows] = useState<AdminReservation[]>([]);

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

  // Load upcoming reservations (next 30 days) for the inbox
  const loadInbox = useCallback(async () => {
    const today = dhakaDate();
    const future = shiftDate(today, 30);
    const res = await supabase.rpc("admin_list_reservations", { p_from: today, p_to: future });
    if (!res.error && res.data) {
      setInboxRows((res.data as AdminReservation[]).sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
    }
  }, [supabase]);

  const loadRef = useRef(load);
  loadRef.current = load;
  const loadInboxRef = useRef(loadInbox);
  loadInboxRef.current = loadInbox;

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        loadRef.current();
        loadInboxRef.current();
      }, 300);
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
  const confirmedCount = rows.filter((r) => inFilter(r, "confirmed")).length;
  const declinedCount = rows.filter((r) => r.status === "rejected").length;
  const isToday = date === dhakaDate();
  const filterLabel = FILTERS.find((f) => f.key === filter)!.label.toLowerCase();
  const viewing = viewingId ? (rows.find((r) => r.id === viewingId) ?? inboxRows.find((r) => r.id === viewingId) ?? null) : null;
  const pendingUpcoming = useMemo(() => inboxRows.filter((r) => r.status === "pending"), [inboxRows]);

  const openFromInbox = (r: AdminReservation) => {
    const targetDate = isoToDhakaDate(r.starts_at);
    setDate(targetDate);
    setViewingId(r.id);
    setInboxOpen(false);
  };

  return (
    <div>
      {/* Page header, set like the public reservation page: gold eyebrow, serif title, one line of
          text. Beside it, the day: arrows either side of the date (the date itself opens the
          calendar), Today and the inbox as quiet text actions, and the day's numbers as a plain strip
          with thin rules between them, not cards. */}
      <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-8">
        <div className="max-w-md">
          <p className="eyebrow">Staff panel</p>
          <h1 className="display mt-2 text-[2.5rem] leading-none text-ink sm:text-[3rem]">Reservations</h1>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-muted">
            Manage guest bookings, confirm or decline, and keep the day&apos;s reservations organized.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-end gap-x-10 gap-y-6 xl:w-auto xl:flex-nowrap">
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-1 border-b border-line pb-2">
              <button type="button" aria-label="Previous day" className={ICON_BUTTON} onClick={() => setDate((d) => shiftDate(d, -1))}>
                <ChevronLeft className="size-4" strokeWidth={1.75} />
              </button>
              <label className="relative flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1 focus-within:outline-2 focus-within:outline-mustard-400 sm:flex-none">
                <CalendarDays aria-hidden className={ICON} strokeWidth={1.75} />
                <span className="display truncate text-[1.45rem] leading-tight text-ink sm:text-[1.6rem]">
                  <span className="sm:hidden">{formatDate(`${date}T12:00:00+06:00`, "en")}</span>
                  <span className="hidden sm:inline">
                    {formatDate(`${date}T12:00:00+06:00`, "en", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Date"
                />
              </label>
              <button type="button" aria-label="Next day" className={ICON_BUTTON} onClick={() => setDate((d) => shiftDate(d, 1))}>
                <ChevronRight className="size-4" strokeWidth={1.75} />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-6">
              <button
                type="button"
                aria-pressed={isToday}
                className={cn(TEXT_ACTION, isToday ? "text-ink-muted/70" : "text-pine-700 hover:text-ink")}
                onClick={() => setDate(dhakaDate())}
              >
                Today
              </button>
              <span aria-hidden className="h-3.5 w-px bg-line" />
              <button
                type="button"
                onClick={() => setInboxOpen(true)}
                aria-label={`Inbox: ${pendingUpcoming.length} pending`}
                className={cn(TEXT_ACTION, "inline-flex items-center gap-2 text-pine-700 hover:text-ink")}
              >
                <Inbox aria-hidden className="size-3.5" strokeWidth={1.75} />
                Inbox
                {pendingUpcoming.length > 0 ? <span className="text-accent-ink tabular-nums">{pendingUpcoming.length} pending</span> : null}
              </button>
            </div>
          </div>

          <div className="w-full sm:w-auto">
            <p className={cn(CAPS, "text-accent-ink")}>{relativeDay(date)}</p>
            <dl className="mt-2 flex divide-x divide-line">
              {[
                { label: "Total bookings", value: rows.length, className: "text-ink" },
                { label: "Confirmed", value: confirmedCount, className: "text-pine-700" },
                { label: "Declined", value: declinedCount, className: declinedCount ? "text-danger" : "text-ink" },
              ].map((s) => (
                <div key={s.label} className="flex flex-col-reverse px-5 first:pl-0 last:pr-0 sm:px-7">
                  <dt className={cn(CAPS, "mt-1 text-[0.65rem] whitespace-nowrap text-ink-muted")}>{s.label}</dt>
                  <dd className={cn("display text-[2rem] leading-none tabular-nums lining-nums", s.className)}>{loading ? "–" : s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Filters as a row of small capitals, the chosen one in teal with a gold underline; search on the right */}
      <div className="mt-9 flex flex-wrap items-end justify-between gap-x-8 gap-y-5 border-b border-line">
        <div role="group" aria-label="Show bookings" className="-mb-px flex flex-wrap gap-x-7 gap-y-1">
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
                  CAPS,
                  "inline-flex items-baseline gap-2 border-b-2 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mustard-400",
                  active ? "border-mustard-400 text-pine-700" : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                {f.label}
                <span className={cn("tabular-nums", active ? "text-pine-700" : "text-ink-muted/70")}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="relative mb-3 w-full sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.5} />
          <Input
            aria-label="Search bookings"
            placeholder="Search by name, phone or reference"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 rounded-sm pl-10 text-sm"
          />
        </div>
      </div>

      {/* The register */}
      <div className="mt-2">
        <div aria-hidden className={cn(ROW_GRID, "hidden border-b border-line py-3 pl-6 xl:grid")}>
          {["Time", "Guest", "Details", "Status", "Actions"].map((h) => (
            <span key={h} className={cn(CAPS, "text-ink-muted")}>
              {h}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-28 animate-pulse bg-surface/60" />
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
          <div className="border-b border-line py-16 text-center">
            {rows.length === 0 ? (
              <>
                <p className="display text-2xl text-ink">No reservations</p>
                <p className="mt-2 text-sm text-ink-muted">There are no reservations for this date.</p>
              </>
            ) : (
              <p className="text-sm text-ink-muted">
                {q && matching.length === 0 ? `No bookings match "${query.trim()}".` : `No ${filterLabel} bookings${q ? ` match "${query.trim()}"` : " for this day"}.`}
              </p>
            )}
          </div>
        ) : (
          <ul>
            {visible.map((r) => (
              <ReservationRow key={r.id} r={r} dayLabel={relativeDay(date)} canDelete={canDelete} onChanged={load} onView={() => setViewingId(r.id)} />
            ))}
          </ul>
        )}
      </div>

      {!loading && !loadFailed && rows.length > 0 ? (
        <p className="mt-4 text-sm text-ink-muted tabular-nums">
          Showing {visible.length} of {rows.length} {rows.length === 1 ? "booking" : "bookings"}
        </p>
      ) : null}

      <ReservationPanel r={viewing} canDelete={canDelete} onChanged={load} onClose={() => setViewingId(null)} />
      <InboxPanel
        open={inboxOpen}
        rows={inboxRows}
        pendingCount={pendingUpcoming.length}
        onSelect={openFromInbox}
        onClose={() => setInboxOpen(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// What staff can do with a booking. Shared by the row (primary button and ⋮ menu) and the panel, so
// both always offer the same actions. The database still decides what is allowed.
// ---------------------------------------------------------------------------
interface BookingAction {
  key: string;
  label: string;
  run: () => void;
  danger?: boolean;
}

function useBookingActions(r: AdminReservation, canDelete: boolean, onChanged: () => void) {
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
    if (!window.confirm(`Delete ${r.customer_name}'s ${STATUS[r.status].label.toLowerCase()} booking (${r.reference}) for good? Its email history goes with it. This can't be undone.`)) return;
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
  const mail = r.last_email;
  // The latest email didn't reach the guest: it failed, or got no answer for 15 minutes.
  const emailProblem =
    ["pending", "confirmed"].includes(r.status) &&
    !!mail &&
    (mail.status === "failed" || (mail.status === "queued" && Date.now() - new Date(mail.at).getTime() > 15 * 60_000));

  const approveCancel: BookingAction = {
    key: "approve",
    label: "Approve cancel",
    danger: true,
    run: () => change("cancelled", "Cancelled, guest emailed", "Cancel this booking? The guest will get an email."),
  };
  const confirm: BookingAction = { key: "confirm", label: "Confirm", run: () => change("confirmed", "Confirmed, guest emailed") };
  const decline: BookingAction = {
    key: "decline",
    label: "Decline",
    danger: true,
    run: () => change("rejected", "Declined, guest emailed", "Decline this booking? The guest will get an email."),
  };
  // For a guest who phones to cancel. Unlike Decline (a request we turn down), this cancels a booking
  // we had confirmed; the seats are freed and the guest is emailed.
  const cancelBooking: BookingAction = {
    key: "cancel",
    label: "Cancel booking",
    danger: true,
    run: () =>
      change(
        "cancelled",
        "Booking cancelled, guest emailed",
        `Cancel ${r.customer_name}'s confirmed booking at ${formatTime(r.starts_at)}? The table is freed and the guest gets a cancellation email. This can't be undone.`,
      ),
  };

  const primary: BookingAction | null = cancelRequested ? approveCancel : r.status === "pending" ? confirm : null;
  const more: BookingAction[] = [];
  if (!cancelRequested && r.status === "pending") more.push(decline);
  if (r.status === "confirmed") more.push(cancelBooking);
  if (emailProblem) more.push({ key: "resend", label: "Resend email", run: resend });
  if (CLOSED.includes(r.status) && canDelete) more.push({ key: "delete", label: "Delete", danger: true, run: remove });

  return { pending, primary, more, cancelRequested, emailProblem, mail, resend };
}

function StatusLabel({ r, cancelRequested }: { r: AdminReservation; cancelRequested: boolean }) {
  const s = cancelRequested ? { label: "Asked to cancel", icon: CircleX, tone: "red" as Tone } : STATUS[r.status];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[0.72rem] font-semibold tracking-[0.1em] whitespace-nowrap uppercase", TONE_TEXT[s.tone])}>
      <Icon aria-hidden className="size-3.5" strokeWidth={2} />
      {s.label}
    </span>
  );
}

/** The time that goes with the state: when the guest asked, or when staff confirmed. */
function statusStamp(r: AdminReservation, cancelRequested: boolean) {
  if (cancelRequested && r.cancel_requested_at) return `Asked ${stamp(r.cancel_requested_at)}`;
  if (r.status === "confirmed" && r.confirmed_at) return `Confirmed ${stamp(r.confirmed_at)}`;
  return `Requested ${stamp(r.created_at)}`;
}

/** The ⋮ menu: the actions that aren't the row's main button, in a small popover. */
function MoreMenu({ label, actions, disabled }: { label: string; actions: BookingAction[]; disabled: boolean }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  // The popover sits in the top layer, so it is placed from the button's position when it opens,
  // and closes when the page scrolls rather than drifting away from its row.
  useEffect(() => {
    const el = menu.current;
    if (!el) return;
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState !== "open" || !button.current) return;
      const b = button.current.getBoundingClientRect();
      el.style.top = `${Math.min(b.bottom + 6, window.innerHeight - el.offsetHeight - 8)}px`;
      el.style.left = `${Math.max(8, b.right - el.offsetWidth)}px`;
      const close = () => el.hidePopover();
      window.addEventListener("scroll", close, { once: true, passive: true });
    };
    el.addEventListener("toggle", onToggle);
    return () => el.removeEventListener("toggle", onToggle);
  }, []);

  return (
    <>
      <button
        ref={button}
        type="button"
        popoverTarget={id}
        aria-label={`More actions for ${label}`}
        aria-haspopup="menu"
        disabled={disabled}
        className={cn(ICON_BUTTON, "disabled:opacity-40")}
      >
        <Ellipsis className="size-4" strokeWidth={1.75} />
      </button>
      <div ref={menu} id={id} popover="auto" role="menu" aria-label={`Actions for ${label}`} className="fixed m-0 min-w-44 rounded-sm border border-line bg-canvas py-1 text-ink shadow-[0_6px_18px_rgb(26_62_65/0.08)]">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            role="menuitem"
            className={cn("block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-ink/5 focus-visible:bg-ink/5 focus-visible:outline-none", a.danger && "text-danger")}
            onClick={() => {
              menu.current?.hidePopover();
              a.run();
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * One booking in the register: time; the guest (serif name, party, phone, email); the details
 * (branch, seating, the guest's note, pre-order, reference); the state; and View, the main action
 * if there is one, and ⋮ for the rest. A thin rule on the left carries the state's colour.
 */
function ReservationRow({
  r,
  dayLabel,
  canDelete,
  onChanged,
  onView,
}: {
  r: AdminReservation;
  dayLabel: string;
  canDelete: boolean;
  onChanged: () => void;
  onView: () => void;
}) {
  const { pending, primary, more, cancelRequested, emailProblem, mail, resend } = useBookingActions(r, canDelete, onChanged);
  const closed = CLOSED.includes(r.status);
  const notes = parseBookingNotes(r.special_requests);
  const branch = r.branch?.name ?? notes.branch;
  const { seating, note } = notes;
  const preOrder = r.pre_order && r.pre_order.status !== "cancelled" ? r.pre_order : null;
  const tone = cancelRequested ? "red" : STATUS[r.status].tone;
  // Lines under the branch start where its text does (past the pin icon); without a branch, flush left.
  const indent = branch || seating ? "pl-5.5" : "";

  return (
    <li className={cn("relative border-b border-line transition-colors before:absolute before:inset-y-5 before:left-0 before:w-[2px] hover:bg-surface/50", TONE_RULE[tone])}>
      <div className={cn(ROW_GRID, "py-6 pl-6")}>
        <div className="[grid-area:time]">
          <p className={cn("text-[1.3rem] leading-tight font-semibold uppercase tabular-nums", closed ? "text-ink-muted" : "text-ink")}>{formatTime(r.starts_at)}</p>
          <p className="mt-1 text-sm text-ink-muted">{dayLabel}</p>
        </div>

        {/* The guest: name, then party and phone on one line, then the email. No icon per line. */}
        <div className="min-w-0 [grid-area:guest]">
          <p className={cn("display text-[1.65rem] leading-tight break-words", closed ? "text-ink-muted" : "text-ink")}>{r.customer_name}</p>
          <p className="mt-1.5 text-[0.92rem] text-ink">
            {r.party_size}
            {r.large_party ? "+" : ""} {r.party_size === 1 ? "person" : "people"}
            <span aria-hidden className="mx-2 text-ink-muted/60">·</span>
            <a href={`tel:${r.phone}`} className="tabular-nums hover:text-primary hover:underline">
              {r.phone.replace(/^\+88/, "")}
            </a>
          </p>
          <a href={`mailto:${r.email}`} className="mt-0.5 block truncate text-[0.92rem] text-ink-muted hover:text-primary hover:underline">
            {r.email}
          </a>
        </div>

        <div className="min-w-0 space-y-2 text-[0.92rem] [grid-area:details]">
          {branch || seating ? (
            <div className="flex gap-2">
              <MapPin aria-hidden className={cn(ICON, "mt-0.5 size-3.5")} strokeWidth={1.75} />
              <div>
                {branch ? <p className="font-medium text-ink">{branch}</p> : null}
                {seating ? <p className="text-ink-muted">{seating}</p> : null}
              </div>
            </div>
          ) : null}
          {note ? <p className={cn(indent, "whitespace-pre-line text-ink italic")}>“{note}”</p> : null}
          {preOrder ? (
            <p className={cn(indent, "font-medium text-primary tabular-nums")}>
              Pre-order: {preOrder.item_count} {preOrder.item_count === 1 ? "item" : "items"} · {formatPrice(Number(preOrder.total))} · {PREORDER_LABEL[preOrder.status]}
            </p>
          ) : null}
          {emailProblem ? (
            <p className={cn(indent, "text-sm text-danger")}>
              The {mail!.kind.replace("_", " ")} email didn&apos;t reach the guest.{" "}
              <button type="button" className="font-semibold underline underline-offset-2 disabled:opacity-50" disabled={pending} onClick={resend}>
                Resend
              </button>
            </p>
          ) : null}
          <p className={cn(indent, "text-xs tracking-[0.08em] text-ink-muted tabular-nums")}>{r.reference}</p>
        </div>

        <div className="flex flex-col items-end gap-1.5 text-right [grid-area:status] xl:items-start xl:text-left">
          <StatusLabel r={r} cancelRequested={cancelRequested} />
          <p className="text-xs text-ink-muted">{statusStamp(r, cancelRequested)}</p>
        </div>

        {/* The one thing to do next (Confirm, or Approve cancel) as a small teal button; View as a
            word; everything else behind the ⋯ menu. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 [grid-area:actions] xl:flex-nowrap xl:self-start xl:justify-end">
          {primary ? (
            <Button
              variant={primary.danger ? "danger" : "pine"}
              className="h-8 rounded-sm px-3.5 text-[0.72rem] font-semibold tracking-[0.1em] uppercase"
              disabled={pending}
              onClick={primary.run}
            >
              {primary.label}
            </Button>
          ) : null}
          <button type="button" className={cn(TEXT_ACTION, "inline-flex items-center gap-1.5 py-1.5 text-pine-700 hover:text-ink")} onClick={onView}>
            <Eye aria-hidden className="size-3.5" strokeWidth={1.75} />
            View
          </button>
          {more.length > 0 ? <MoreMenu label={r.customer_name} actions={more} disabled={pending} /> : null}
        </div>
      </div>
    </li>
  );
}

/**
 * The booking in full, in a panel from the right (a modal <dialog>, so focus stays inside and Escape
 * closes it): guest, contact, reservation, branch, seating, notes, pre-order, status and activity,
 * with the same actions as the row at the bottom.
 */
function ReservationPanel({ r, canDelete, onChanged, onClose }: { r: AdminReservation | null; canDelete: boolean; onChanged: () => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const open = Boolean(r);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-md bg-canvas p-0 text-ink backdrop:bg-pine-900/40 sm:border-l sm:border-line"
    >
      {r ? <PanelBody r={r} titleId={titleId} canDelete={canDelete} onChanged={onChanged} onClose={() => dialog.current?.close()} /> : null}
    </dialog>
  );
}

function PanelBody({ r, titleId, canDelete, onChanged, onClose }: { r: AdminReservation; titleId: string; canDelete: boolean; onChanged: () => void; onClose: () => void }) {
  const { pending, primary, more, cancelRequested, emailProblem, mail } = useBookingActions(r, canDelete, onChanged);
  const notes = parseBookingNotes(r.special_requests);
  const branch = r.branch?.name ?? notes.branch;
  const preOrder = r.pre_order && r.pre_order.status !== "cancelled" ? r.pre_order : null;
  const actions = [...(primary ? [primary] : []), ...more];

  const section = (label: string, body: React.ReactNode) => (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-5 border-b border-line py-4 text-[0.92rem] last:border-b-0">
      <dt className={cn(CAPS, "pt-0.5 text-[0.65rem] text-ink-muted")}>{label}</dt>
      <dd className="min-w-0 text-ink">{body}</dd>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-line px-7 pt-7 pb-6">
        <div className="min-w-0">
          <p className="eyebrow">Reservation · {r.reference}</p>
          <h2 id={titleId} className="display mt-1.5 text-[2.1rem] leading-tight break-words">
            {r.customer_name}
          </h2>
          <div className="mt-2">
            <StatusLabel r={r} cancelRequested={cancelRequested} />
          </div>
        </div>
        <button type="button" aria-label="Close" className={cn(ICON_BUTTON, "-mr-2")} onClick={onClose}>
          <X className="size-5" strokeWidth={1.5} />
        </button>
      </div>

      <dl className="flex-1 overflow-y-auto px-7">
        {section(
          "Guest",
          <div className="space-y-1">
            <p>
              {r.party_size}
              {r.large_party ? "+" : ""} {r.party_size === 1 ? "person" : "people"}
            </p>
            <a href={`tel:${r.phone}`} className="block tabular-nums hover:text-primary hover:underline">
              {r.phone.replace(/^\+88/, "")}
            </a>
            <a href={`mailto:${r.email}`} className="block break-all text-ink-muted hover:text-primary hover:underline">
              {r.email}
            </a>
          </div>,
        )}
        {section(
          "Reservation",
          <p className="tabular-nums">
            {formatDate(r.starts_at, "en", { weekday: "long", day: "numeric", month: "long" })}
            <br />
            {formatTime(r.starts_at)} – {formatTime(r.ends_at)}
          </p>,
        )}
        {section("Branch", branch ?? <span className="text-ink-muted">Not given</span>)}
        {section("Seating", notes.seating ?? r.area?.name ?? <span className="text-ink-muted">Not given</span>)}
        {section("Note", notes.note ? <p className="whitespace-pre-line italic">“{notes.note}”</p> : <span className="text-ink-muted">None</span>)}
        {section(
          "Pre-order",
          preOrder ? (
            <span className="tabular-nums">
              {preOrder.item_count} {preOrder.item_count === 1 ? "item" : "items"} · {formatPrice(Number(preOrder.total))} · {PREORDER_LABEL[preOrder.status]}
            </span>
          ) : (
            <span className="text-ink-muted">None</span>
          ),
        )}
        {section("Status", <span>{statusStamp(r, cancelRequested)}</span>)}
        {section(
          "Activity",
          <ul className="space-y-1 text-ink-muted">
            <li>Requested {stamp(r.created_at)}</li>
            {r.confirmed_at ? <li>Confirmed {stamp(r.confirmed_at)}</li> : null}
            {r.cancel_requested_at ? <li>Guest asked to cancel {stamp(r.cancel_requested_at)}</li> : null}
            {mail ? (
              <li className={emailProblem ? "text-danger" : undefined}>
                Last email: {mail.kind.replace("_", " ")}, {mail.status} {stamp(mail.at)}
              </li>
            ) : null}
          </ul>,
        )}
      </dl>

      {/* Every action for this booking: the main one as a teal button, the rest as words. */}
      {actions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line px-7 py-5">
          {actions.map((a, i) =>
            i === 0 && primary ? (
              <Button
                key={a.key}
                variant={a.danger ? "danger" : "pine"}
                className="h-9 rounded-sm px-4 text-[0.72rem] font-semibold tracking-[0.1em] uppercase"
                disabled={pending}
                onClick={a.run}
              >
                {a.label}
              </Button>
            ) : (
              <button
                key={a.key}
                type="button"
                className={cn(TEXT_ACTION, "py-2 disabled:opacity-50", a.danger ? "text-danger hover:text-danger/80" : "text-pine-700 hover:text-ink")}
                disabled={pending}
                onClick={a.run}
              >
                {a.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Slide-over drawer listing all upcoming and future reservations (next 30 days),
 * with a focus on pending requests so staff never miss a future booking.
 */
function InboxPanel({
  open,
  rows,
  pendingCount,
  onSelect,
  onClose,
}: {
  open: boolean;
  rows: AdminReservation[];
  pendingCount: number;
  onSelect: (r: AdminReservation) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const visible = filter === "pending" ? rows.filter((r) => r.status === "pending") : rows;
  const tabs = [
    { key: "pending" as const, label: "Pending", count: pendingCount },
    { key: "all" as const, label: "All upcoming", count: rows.length },
  ];

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-md bg-canvas p-0 text-ink backdrop:bg-pine-900/40 sm:border-l sm:border-line"
    >
      {open ? (
        <div className="flex h-full flex-col">
          {/* A booking ledger sliding over the page: gold eyebrow, serif title, one line of text. */}
          <div className="flex items-start justify-between gap-4 px-7 pt-7 pb-5">
            <div>
              <p className="eyebrow">Next 30 days</p>
              <h2 id={titleId} className="display mt-1.5 text-[2rem] leading-tight text-ink">
                Reservations Inbox
              </h2>
              <p className="mt-1.5 text-sm text-ink-muted">Preview incoming bookings and requests across all future dates.</p>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close inbox" className={cn(ICON_BUTTON, "-mr-2")}>
              <X className="size-5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Two tabs as small capitals; the chosen one in teal with a gold underline. */}
          <div role="group" aria-label="Show" className="flex gap-7 border-b border-line px-7">
            {tabs.map((tab) => {
              const active = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(tab.key)}
                  className={cn(
                    CAPS,
                    "-mb-px inline-flex items-baseline gap-2 border-b-2 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mustard-400",
                    active ? "border-mustard-400 text-pine-700" : "border-transparent text-ink-muted hover:text-ink",
                  )}
                >
                  {tab.label}
                  <span className="tabular-nums">{tab.count}</span>
                </button>
              );
            })}
          </div>

          {/* The bookings as one list with thin rules between them: state and day on the left, time on
              the right, the guest's name in serif, then party, date and branch, the note, and the
              reference with the way to the register. Pending ones carry a thin gold rule. */}
          <div className="flex-1 overflow-y-auto">
            {visible.length === 0 ? (
              <div className="px-7 py-20 text-center">
                <p className="display text-2xl text-ink">{filter === "pending" ? "Nothing waiting" : "No upcoming reservations"}</p>
                <p className="mt-2 text-sm text-ink-muted">New requests from guests appear here as they come in.</p>
              </div>
            ) : (
              <ul>
                {visible.map((r) => {
                  const notes = parseBookingNotes(r.special_requests);
                  const branch = r.branch?.name ?? notes.branch;
                  const s = STATUS[r.status];
                  return (
                    <li key={r.id} className="border-b border-line last:border-b-0">
                      <button
                        type="button"
                        onClick={() => onSelect(r)}
                        className={cn(
                          "group relative block w-full px-7 py-5 text-left transition-colors hover:bg-surface/60 focus-visible:bg-surface/60 focus-visible:outline-none",
                          "before:absolute before:inset-y-5 before:left-0 before:w-[2px]",
                          r.status === "pending" ? "before:bg-mustard-400" : "before:bg-transparent",
                        )}
                      >
                        <span className="flex items-baseline justify-between gap-4">
                          <span className={cn(CAPS, "text-[0.65rem]", TONE_TEXT[s.tone])}>
                            {s.label}
                            <span className="ml-2 text-ink-muted">· {relativeDay(isoToDhakaDate(r.starts_at))}</span>
                          </span>
                          <span className="text-sm font-semibold text-ink uppercase tabular-nums">{formatTime(r.starts_at)}</span>
                        </span>
                        <span className="display mt-1.5 block text-[1.4rem] leading-tight text-ink group-hover:text-pine-700">{r.customer_name}</span>
                        <span className="mt-1 block text-[0.85rem] text-ink-muted">
                          {r.party_size} {r.party_size === 1 ? "person" : "people"}
                          <span aria-hidden className="mx-1.5">·</span>
                          {formatDate(r.starts_at, "en", { weekday: "short", day: "numeric", month: "short" })}
                          {branch ? (
                            <>
                              <span aria-hidden className="mx-1.5">·</span>
                              {branch}
                            </>
                          ) : null}
                        </span>
                        {notes.note ? <span className="mt-2 line-clamp-2 block text-[0.85rem] text-ink italic">“{notes.note}”</span> : null}
                        <span className="mt-3 flex items-center justify-between gap-4 text-xs">
                          <span className="tracking-[0.08em] text-ink-muted tabular-nums">{r.reference}</span>
                          <span className={cn(TEXT_ACTION, "text-[0.65rem] text-pine-700 group-hover:text-ink")}>View in register →</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
