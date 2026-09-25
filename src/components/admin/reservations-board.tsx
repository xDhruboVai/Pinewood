"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { resendEmail, setReservationStatus, setWaitlistStatus } from "@/actions/admin";
import { PREORDER_LABEL } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { parseBookingNotes } from "@/lib/booking-notes";
import { createClient } from "@/lib/supabase/client";
import { dhakaDate, formatDate, formatPrice, formatTime, isoToDhakaDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminReservation, ReservationStatus, WaitlistEntry } from "@/lib/types";

// One grid for the list and its header row: time, guest, people, email, phone, action.
const ROW_GRID =
  "grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-5 gap-y-2 px-3 lg:grid-cols-[7.5rem_minmax(0,1.2fr)_5rem_minmax(0,1.4fr)_9.5rem_14rem] lg:gap-x-8";
// Time in the site's sans, weighted like the menu's prices.
const TIME = "text-[1.25rem] font-semibold whitespace-nowrap text-ink tabular-nums";
// Guest name in the menu's dish-name style.
const NAME = "truncate text-[1.05rem] font-semibold tracking-[0.03em] text-ink uppercase";
// The other cells sit under the name on phones and in their own column on desktop.
const CELL = "col-start-2 text-[1rem] lg:col-start-auto";
// Secondary actions: small wide-tracked caps, like the site's navigation, without a box.
const SECONDARY = "text-[0.78rem] font-semibold tracking-[0.12em] whitespace-nowrap text-ink-muted uppercase transition-colors hover:text-ink disabled:opacity-50";

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00+06:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d);
}

export function ReservationsBoard({
  initialDate,
}: {
  initialDate: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [date, setDate] = useState(initialDate);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AdminReservation[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  // Only the latest load may fill the board: flicking through days quickly, a slower answer for an
  // earlier day is dropped instead of showing that day's bookings under the new date.
  const loadRequest = useRef(0);
  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    const from = new Date(`${date}T00:00:00+06:00`).toISOString();
    const to = new Date(`${shiftDate(date, 1)}T00:00:00+06:00`).toISOString();
    const [res, wl] = await Promise.all([
      supabase.rpc("admin_list_reservations", { p_from: date, p_to: date }),
      supabase.from("waitlist_entries").select("*").gte("starts_at", from).lt("starts_at", to).order("starts_at"),
    ]);
    if (request !== loadRequest.current) return;
    // Say plainly that the list didn't load (not "no bookings"); the details go to the console.
    if (res.error) console.error("admin_list_reservations failed", res.error);
    setLoadFailed(Boolean(res.error));
    setRows((res.data ?? []) as AdminReservation[]);
    setWaitlist((wl.data ?? []) as WaitlistEntry[]);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "pre_orders" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist_entries" }, refresh)
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      !q || r.customer_name.toLowerCase().includes(q) || r.phone.includes(q) || r.reference.toLowerCase().includes(q) || r.email.includes(q),
  );
  const covers = rows.filter((r) => ["confirmed", "seated", "completed"].includes(r.status)).reduce((s, r) => s + r.party_size, 0);
  const waiting = waitlist.filter((w) => w.status === "waiting");
  const toCall = rows.filter((r) => r.status === "pending").length;

  return (
    <div>
      {/* Controls: the day, a one-line summary and search. The list shows the whole day in time order. */}
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-b border-line pb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous day"
            className="inline-flex size-10 items-center justify-center rounded-sm border border-line text-ink-muted transition-colors hover:border-ink/35 hover:text-ink"
            onClick={() => setDate((d) => shiftDate(d, -1))}
          >
            <ChevronLeft className="size-4" strokeWidth={1.5} />
          </button>
          <label className="relative px-1">
            <span className="display text-3xl text-ink sm:text-4xl">{formatDate(`${date}T12:00:00+06:00`, "en", { weekday: "long", month: "long" })}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Date"
            />
          </label>
          <button
            type="button"
            aria-label="Next day"
            className="inline-flex size-10 items-center justify-center rounded-sm border border-line text-ink-muted transition-colors hover:border-ink/35 hover:text-ink"
            onClick={() => setDate((d) => shiftDate(d, 1))}
          >
            <ChevronRight className="size-4" strokeWidth={1.5} />
          </button>
          {date !== dhakaDate() ? (
            <button type="button" className="ml-2 text-sm font-medium text-primary hover:text-accent-ink" onClick={() => setDate(dhakaDate())}>
              Back to today
            </button>
          ) : null}
        </div>
        <p className="text-sm text-ink-muted lg:mr-auto lg:ml-4">
          <span className="font-semibold text-ink tabular-nums">{covers}</span> guests confirmed · {rows.length} {rows.length === 1 ? "booking" : "bookings"}
          {toCall ? <span className="text-accent-ink"> · {toCall} to call</span> : null}
        </p>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.5} />
          <Input aria-label="Search bookings" placeholder="Name, phone or reference" value={query} onChange={(e) => setQuery(e.target.value)} className="h-11 rounded-sm pl-10 text-sm" />
        </div>
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
          {rows.length > 0 ? `No bookings match "${query.trim()}".` : "No bookings for this day."}
        </p>
      ) : (
        <ul>
          <li aria-hidden className={cn(ROW_GRID, "hidden py-3 lg:grid")}>
            {["Time", "Guest", "People", "Email", "Phone"].map((h) => (
              <span key={h} className="label text-ink-muted">
                {h}
              </span>
            ))}
            <span />
          </li>
          {visible.map((r) => (
            <ReservationRow key={r.id} r={r} onChanged={load} />
          ))}
        </ul>
      )}

      {waiting.length > 0 ? (
        <section className="pt-16">
          <h2 className="display text-3xl text-ink">
            Waitlist <span className="text-ink-muted">{waiting.length}</span>
          </h2>
          <p className="mt-1 text-sm text-ink-muted">When seats free up, the guest who joined first gets them automatically.</p>
          <ul className="mt-6 border-t border-line">
            {waiting.map((w) => (
              <li key={w.id} className={cn(ROW_GRID, "items-center border-b border-line py-4")}>
                <span className={TIME}>{formatTime(w.starts_at)}</span>
                <span className={NAME}>{w.customer_name}</span>
                <span className={cn(CELL, "text-ink")}>
                  {w.party_size}
                  {w.large_party ? "+" : ""}
                </span>
                <a href={`mailto:${w.email}`} className={cn(CELL, "truncate text-ink-muted hover:text-ink")}>
                  {w.email}
                </a>
                <a href={`tel:${w.phone}`} className={cn(CELL, "font-medium text-primary tabular-nums hover:text-accent-ink")}>
                  {w.phone.replace(/^\+88/, "")}
                </a>
                <button
                  type="button"
                  className={cn(SECONDARY, "col-start-2 justify-self-start lg:col-start-auto lg:justify-self-end")}
                  onClick={async () => {
                    const res = await setWaitlistStatus(w.id, "cancelled");
                    if (!res.ok) toast.error(res.error);
                    else load();
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

// What a booking says once it has been dealt with.
const DONE_LABEL: Record<ReservationStatus, string> = {
  pending: "",
  confirmed: "Confirmed",
  seated: "Seated",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Declined",
  expired: "Not confirmed",
  no_show: "No-show",
};

/**
 * One booking: time, guest name, people, email, phone, and one action. A new booking can be
 * confirmed or declined; after that the row just says what happened. If the guest asked to cancel
 * (through the link in their email), the action is "Approve cancel".
 */
function ReservationRow({ r, onChanged }: { r: AdminReservation; onChanged: () => void }) {
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

  const cancelRequested = Boolean(r.cancel_requested_at) && ["pending", "confirmed"].includes(r.status);
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
    <li className={cn("border-b border-line", cancelRequested ? "bg-red-50/70" : r.status === "pending" ? "bg-mustard-400/10" : undefined)}>
      <div className={cn(ROW_GRID, "items-center py-5")}>
        <span className={TIME}>{formatTime(r.starts_at)}</span>
        <span className={NAME}>{r.customer_name}</span>
        <span className={cn(CELL, "text-ink")}>
          {r.party_size}
          {r.large_party ? "+" : ""}
          <span className="text-ink-muted lg:hidden"> {r.party_size === 1 ? "guest" : "guests"}</span>
        </span>
        <a href={`mailto:${r.email}`} className={cn(CELL, "truncate text-ink-muted hover:text-ink")}>
          {r.email}
        </a>
        <a href={`tel:${r.phone}`} className={cn(CELL, "font-medium text-primary tabular-nums hover:text-accent-ink")}>
          {r.phone.replace(/^\+88/, "")}
        </a>

        <div className="col-start-2 flex flex-wrap items-center gap-x-4 gap-y-2 lg:col-start-auto lg:flex-nowrap lg:justify-end">
          {cancelRequested ? (
            <>
              <span className="text-xs font-semibold text-danger">Asked to cancel</span>
              <Button
                size="sm"
                variant="danger"
                disabled={pending}
                onClick={() => change("cancelled", "Cancelled, guest emailed", "Cancel this booking? The guest will get an email.")}
              >
                Approve cancel
              </Button>
            </>
          ) : r.status === "pending" ? (
            <>
              <Button variant="pine" className="h-10 min-w-28 px-5 text-[0.78rem]" disabled={pending} onClick={() => change("confirmed", "Confirmed, guest emailed")}>
                Confirm
              </Button>
              <button
                type="button"
                className={SECONDARY}
                disabled={pending}
                onClick={() => change("rejected", "Declined, guest emailed", "Decline this booking? The guest will get an email.")}
              >
                Decline
              </button>
            </>
          ) : r.status === "confirmed" ? (
            <>
              <StateLabel status={r.status} />
              {/* For a guest who phones to cancel. Unlike Decline (a request we turn down), this cancels a
                  booking we had confirmed; the seats are freed and the guest is emailed. */}
              <button
                type="button"
                className={cn(SECONDARY, "hover:text-danger")}
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
            <StateLabel status={r.status} />
          )}
        </div>

        {branch || seating || note || preOrder || emailProblem ? (
          <div className="col-start-2 space-y-1.5 lg:col-[2/-1]">
            {branch || seating ? (
              <p className="text-[0.78rem] font-semibold tracking-[0.12em] text-ink uppercase">{[branch, seating].filter(Boolean).join(" · ")}</p>
            ) : null}
            {note ? <p className="max-w-3xl text-[0.95rem] leading-relaxed whitespace-pre-line text-ink-muted">“{note}”</p> : null}
            {preOrder ? (
              <Link
                href={`/admin/kitchen?date=${isoToDhakaDate(r.starts_at)}`}
                className="inline-block text-[0.9rem] font-medium text-primary tabular-nums hover:text-accent-ink"
              >
                Pre-order: {preOrder.item_count} {preOrder.item_count === 1 ? "item" : "items"} · {formatPrice(Number(preOrder.total))} ·{" "}
                {PREORDER_LABEL[preOrder.status]}
              </Link>
            ) : null}
            {emailProblem ? (
              <p className="text-[0.85rem] text-danger">
                The {mail!.kind.replace("_", " ")} email didn&apos;t reach the guest.{" "}
                <button type="button" className="font-semibold underline underline-offset-2 disabled:opacity-50" disabled={pending} onClick={resend}>
                  Resend
                </button>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/**
 * A handled booking's state. "Confirmed" gets a small hand-drawn tick in Pinewood green (in the
 * spirit of the drawn stroke under the hero's "Open till" note); "Declined" and "No-show" a drawn
 * cross; everything else is a quiet word.
 */
function StateLabel({ status }: { status: ReservationStatus }) {
  const label = DONE_LABEL[status];
  if (status === "confirmed") {
    return (
      <span className="inline-flex items-center gap-2 text-[0.95rem] font-semibold text-pine-700">
        <svg aria-hidden viewBox="0 0 24 24" fill="none" className="size-5 -rotate-6">
          <path d="M3.5 12.8c2 1.6 3.6 3.4 5 5.6 2.6-5.4 6.4-9.8 11.8-13.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {label}
      </span>
    );
  }
  if (status === "rejected" || status === "no_show") {
    return (
      <span className="inline-flex items-center gap-2 text-[0.95rem] font-medium text-danger">
        <svg aria-hidden viewBox="0 0 24 24" fill="none" className="size-4">
          <path d="M6 6.5c4 3.4 8 7.4 12 11.5M17.5 6c-3.8 3.6-7.6 7.6-11 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {label}
      </span>
    );
  }
  return <span className="text-[0.95rem] text-ink-muted">{label}</span>;
}
