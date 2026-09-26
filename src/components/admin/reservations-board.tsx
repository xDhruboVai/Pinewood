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
  EllipsisVertical,
  Eye,
  Mail,
  MapPin,
  Phone,
  Quote,
  Search,
  UsersRound,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react";
import { deleteReservation, resendEmail, setReservationStatus } from "@/actions/admin";
import { PREORDER_LABEL } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { parseBookingNotes } from "@/lib/booking-notes";
import { createClient } from "@/lib/supabase/client";
import { dhakaDate, formatDate, formatPrice, formatTime } from "@/lib/format";
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

// How each state reads: a small outlined label with an icon, and the colour of the row's left rule.
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
const TONE_BADGE: Record<Tone, string> = {
  gold: "border-mustard-400/80 bg-mustard-400/10 text-accent-ink",
  teal: "border-pine-600/35 bg-pine-600/[0.06] text-pine-700",
  red: "border-danger/35 bg-danger/[0.05] text-danger",
  muted: "border-line bg-transparent text-ink-muted",
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
  const confirmedCount = rows.filter((r) => inFilter(r, "confirmed")).length;
  const declinedCount = rows.filter((r) => r.status === "rejected").length;
  const isToday = date === dhakaDate();
  const filterLabel = FILTERS.find((f) => f.key === filter)!.label.toLowerCase();
  const viewing = viewingId ? (rows.find((r) => r.id === viewingId) ?? null) : null;

  return (
    <div>
      {/* Page header: title on the left; the day and its numbers on the right */}
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
        <div className="max-w-sm">
          <p className="eyebrow">Staff panel</p>
          <h1 className="display mt-1.5 text-[2.5rem] leading-none text-ink sm:text-[3rem]">Reservations</h1>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-muted">
            Manage guest bookings, confirm or decline, and keep the day&apos;s reservations organized.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-start gap-4 sm:w-auto xl:flex-nowrap">
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <div className="flex min-w-0 flex-1 items-stretch rounded-sm border border-line bg-surface sm:flex-none">
              <button type="button" aria-label="Previous day" className="inline-flex w-10 shrink-0 items-center justify-center text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink" onClick={() => setDate((d) => shiftDate(d, -1))}>
                <ChevronLeft className="size-4" strokeWidth={1.75} />
              </button>
              <label className="relative flex min-w-0 flex-1 items-center gap-2.5 border-x border-line px-3 py-2.5 sm:px-4 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-mustard-400">
                <CalendarDays aria-hidden className={ICON} strokeWidth={1.75} />
                <span className="truncate text-[0.95rem] font-medium text-ink">
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
              <button type="button" aria-label="Next day" className="inline-flex w-10 shrink-0 items-center justify-center text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink" onClick={() => setDate((d) => shiftDate(d, 1))}>
                <ChevronRight className="size-4" strokeWidth={1.75} />
              </button>
            </div>
            <Button
              variant="ghost"
              aria-pressed={isToday}
              className={cn("h-11 shrink-0 rounded-sm border border-line px-4 text-sm font-medium", isToday && "text-ink-muted")}
              onClick={() => setDate(dhakaDate())}
            >
              Today
            </Button>
          </div>

          {/* The chosen day in three numbers: a quiet bordered panel, not a row of cards */}
          <div className="w-full rounded-sm border border-line bg-surface/70 px-5 py-3 sm:w-auto">
            <p className={cn(CAPS, "text-ink-muted")}>{relativeDay(date)}</p>
            <dl className="mt-1.5 grid grid-cols-3 divide-x divide-line text-center">
              {[
                { label: "Total bookings", value: rows.length, className: "text-ink" },
                { label: "Confirmed", value: confirmedCount, className: "text-pine-700" },
                { label: "Declined", value: declinedCount, className: declinedCount ? "text-danger" : "text-ink" },
              ].map((s) => (
                <div key={s.label} className="flex flex-col-reverse px-4 first:pl-0 last:pr-0 sm:px-6">
                  <dt className="text-xs whitespace-nowrap text-ink-muted">{s.label}</dt>
                  <dd className={cn("display text-[1.75rem] leading-tight tabular-nums lining-nums", s.className)}>{loading ? "–" : s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Filters and search */}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-line pt-5">
        <div role="group" aria-label="Show bookings" className="flex flex-wrap gap-2">
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
                  "inline-flex h-9 items-center gap-2 rounded-sm border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mustard-400",
                  active ? "border-pine-700 bg-pine-700 text-cream-50" : "border-line text-ink hover:border-ink/30",
                )}
              >
                {f.label}
                <span className={cn("min-w-5 rounded-sm px-1 text-center text-xs leading-5 tabular-nums", active ? "bg-cream-50/15" : "bg-ink/[0.06] text-ink-muted")}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-80">
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
      <div className="mt-5 border-t border-line">
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
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[0.82rem] font-medium whitespace-nowrap", TONE_BADGE[s.tone])}>
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
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-40"
      >
        <EllipsisVertical className="size-4" strokeWidth={1.75} />
      </button>
      <div ref={menu} id={id} popover="auto" role="menu" aria-label={`Actions for ${label}`} className="fixed m-0 min-w-44 rounded-sm border border-line bg-surface p-1 text-ink shadow-[0_8px_24px_rgb(26_62_65/0.12)]">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            role="menuitem"
            className={cn("block w-full rounded-[2px] px-3 py-2 text-left text-sm transition-colors hover:bg-ink/5 focus-visible:bg-ink/5 focus-visible:outline-none", a.danger && "text-danger")}
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

  return (
    <li className={cn("relative border-b border-line before:absolute before:inset-y-0 before:left-0 before:w-[3px]", TONE_RULE[tone])}>
      <div className={cn(ROW_GRID, "py-5 pl-6")}>
        <div className="[grid-area:time]">
          <p className={cn("text-[1.25rem] leading-tight font-semibold uppercase tabular-nums", closed ? "text-ink-muted" : "text-ink")}>{formatTime(r.starts_at)}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{dayLabel}</p>
        </div>

        <div className="min-w-0 [grid-area:guest]">
          <p className={cn("display text-[1.6rem] leading-tight break-words", closed ? "text-ink-muted" : "text-ink")}>{r.customer_name}</p>
          <ul className="mt-2 space-y-1.5 text-[0.92rem]">
            <li className="flex items-center gap-2.5 text-ink">
              <UsersRound aria-hidden className={ICON} strokeWidth={1.75} />
              {r.party_size}
              {r.large_party ? "+" : ""} {r.party_size === 1 ? "person" : "people"}
            </li>
            <li className="flex items-center gap-2.5">
              <Phone aria-hidden className={ICON} strokeWidth={1.75} />
              <a href={`tel:${r.phone}`} className="text-ink tabular-nums hover:text-primary hover:underline">
                {r.phone.replace(/^\+88/, "")}
              </a>
            </li>
            <li className="flex min-w-0 items-center gap-2.5">
              <Mail aria-hidden className={ICON} strokeWidth={1.75} />
              <a href={`mailto:${r.email}`} className="min-w-0 truncate text-primary hover:underline">
                {r.email}
              </a>
            </li>
          </ul>
        </div>

        <div className="min-w-0 space-y-2.5 text-[0.92rem] [grid-area:details]">
          {branch || seating ? (
            <div className="flex gap-2.5">
              <MapPin aria-hidden className={cn(ICON, "mt-0.5")} strokeWidth={1.75} />
              <div>
                {branch ? <p className="font-medium text-ink">{branch}</p> : null}
                {seating ? <p className="text-ink-muted">{seating}</p> : null}
              </div>
            </div>
          ) : null}
          {note ? (
            <div className="flex gap-2.5">
              <Quote aria-hidden className={cn(ICON, "mt-0.5")} strokeWidth={1.75} />
              <p className="whitespace-pre-line text-ink italic">“{note}”</p>
            </div>
          ) : null}
          {preOrder ? (
            <div className="flex gap-2.5">
              <UtensilsCrossed aria-hidden className={cn(ICON, "mt-0.5")} strokeWidth={1.75} />
              <p className="font-medium text-primary tabular-nums">
                Pre-order: {preOrder.item_count} {preOrder.item_count === 1 ? "item" : "items"} · {formatPrice(Number(preOrder.total))} · {PREORDER_LABEL[preOrder.status]}
              </p>
            </div>
          ) : null}
          {emailProblem ? (
            <p className="text-sm text-danger">
              The {mail!.kind.replace("_", " ")} email didn&apos;t reach the guest.{" "}
              <button type="button" className="font-semibold underline underline-offset-2 disabled:opacity-50" disabled={pending} onClick={resend}>
                Resend
              </button>
            </p>
          ) : null}
          <p className="text-xs tracking-[0.06em] text-ink-muted tabular-nums">{r.reference}</p>
        </div>

        <div className="flex flex-col items-end gap-1.5 text-right [grid-area:status] xl:items-start xl:text-left">
          <StatusLabel r={r} cancelRequested={cancelRequested} />
          <p className="text-xs text-ink-muted">{statusStamp(r, cancelRequested)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 [grid-area:actions] xl:flex-nowrap xl:self-start xl:justify-end">
          {primary ? (
            <Button
              variant={primary.danger ? "danger" : "pine"}
              className="h-9 rounded-sm px-4 text-sm normal-case tracking-normal"
              disabled={pending}
              onClick={primary.run}
            >
              {primary.label}
            </Button>
          ) : null}
          <Button variant="ghost" className="h-9 gap-2 rounded-sm border border-ink/25 px-3.5 text-sm font-medium" onClick={onView}>
            <Eye aria-hidden className="size-4" strokeWidth={1.75} />
            View
          </Button>
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
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 border-b border-line py-3.5 text-[0.92rem]">
      <dt className={cn(CAPS, "pt-0.5 text-ink-muted")}>{label}</dt>
      <dd className="min-w-0 text-ink">{body}</dd>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 pt-6 pb-5">
        <div className="min-w-0">
          <p className="eyebrow">Reservation · {r.reference}</p>
          <h2 id={titleId} className="display mt-1 text-[2rem] leading-tight break-words">
            {r.customer_name}
          </h2>
          <div className="mt-2">
            <StatusLabel r={r} cancelRequested={cancelRequested} />
          </div>
        </div>
        <button type="button" aria-label="Close" className="-mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:bg-ink/5 hover:text-ink" onClick={onClose}>
          <X className="size-5" strokeWidth={1.75} />
        </button>
      </div>

      <dl className="flex-1 overflow-y-auto px-6">
        {section("Guest", `${r.party_size}${r.large_party ? "+" : ""} ${r.party_size === 1 ? "person" : "people"}`)}
        {section(
          "Contact",
          <div className="space-y-1">
            <a href={`tel:${r.phone}`} className="block tabular-nums hover:text-primary hover:underline">
              {r.phone.replace(/^\+88/, "")}
            </a>
            <a href={`mailto:${r.email}`} className="block break-all text-primary hover:underline">
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
        {section("Notes", notes.note ? <p className="whitespace-pre-line italic">“{notes.note}”</p> : <span className="text-ink-muted">None</span>)}
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

      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-line px-6 py-4">
          {actions.map((a, i) => (
            <Button
              key={a.key}
              variant={i === 0 && primary ? (a.danger ? "danger" : "pine") : "ghost"}
              className={cn("h-10 rounded-sm px-4 text-sm normal-case tracking-normal", !(i === 0 && primary) && "border border-ink/25", !(i === 0 && primary) && a.danger && "text-danger")}
              disabled={pending}
              onClick={a.run}
            >
              {a.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
