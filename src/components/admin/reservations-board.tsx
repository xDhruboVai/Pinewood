"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  RotateCcw,
  Search,
  UserCheck,
  Utensils,
  X,
} from "lucide-react";
import {
  assignTables,
  dismissCancelRequest,
  resendEmail,
  setReservationStatus,
  setWaitlistStatus,
  updateStaffNotes,
} from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form";
import { StatusBadge, relativeFromNow } from "./ui";
import { createClient } from "@/lib/supabase/client";
import { dhakaDate, formatDateLong, formatPrice, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActionResult, AdminReservation, Area, DiningTable, ReservationStatus, WaitlistEntry } from "@/lib/types";

type Filter = "all" | "pending" | "confirmed" | "seated" | "cancel_requests" | "closed";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "seated", label: "Seated" },
  { key: "cancel_requests", label: "Cancel requests" },
  { key: "closed", label: "Closed" },
];

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00+06:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d);
}

function matches(r: AdminReservation, f: Filter) {
  switch (f) {
    case "all":
      return true;
    case "pending":
    case "confirmed":
    case "seated":
      return r.status === f;
    case "cancel_requests":
      return Boolean(r.cancel_requested_at) && ["pending", "confirmed"].includes(r.status);
    case "closed":
      return ["completed", "cancelled", "rejected", "expired", "no_show"].includes(r.status);
  }
}

export function ReservationsBoard({
  initialDate,
  initialFilter,
  areas,
  tables,
}: {
  initialDate: string;
  initialFilter: Filter;
  areas: Area[];
  tables: DiningTable[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [date, setDate] = useState(initialDate);
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AdminReservation[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const from = new Date(`${date}T00:00:00+06:00`).toISOString();
    const to = new Date(`${shiftDate(date, 1)}T00:00:00+06:00`).toISOString();
    const [res, wl] = await Promise.all([
      supabase.rpc("admin_list_reservations", { p_from: date, p_to: date }),
      supabase.from("waitlist_entries").select("*").gte("starts_at", from).lt("starts_at", to).order("starts_at"),
    ]);
    if (res.error) toast.error(res.error.message);
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

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter((r) => matches(r, f.key)).length])), [rows]);
  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      matches(r, filter) &&
      (!q || r.customer_name.toLowerCase().includes(q) || r.phone.includes(q) || r.reference.toLowerCase().includes(q) || r.email.includes(q)),
  );
  const covers = rows.filter((r) => ["confirmed", "seated", "completed"].includes(r.status)).reduce((s, r) => s + r.party_size, 0);
  const waiting = waitlist.filter((w) => w.status === "waiting");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-sm border border-line bg-surface">
          <button type="button" aria-label="Previous day" className="p-2.5 text-ink-muted hover:text-ink" onClick={() => setDate((d) => shiftDate(d, -1))}>
            <ChevronLeft className="size-4" />
          </button>
          <label className="flex items-center gap-2 border-x border-line px-3">
            <CalendarDays className="size-4 text-ink-muted" aria-hidden />
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-10 bg-transparent text-sm text-ink focus:outline-none"
              aria-label="Date"
            />
          </label>
          <button type="button" aria-label="Next day" className="p-2.5 text-ink-muted hover:text-ink" onClick={() => setDate((d) => shiftDate(d, 1))}>
            <ChevronRight className="size-4" />
          </button>
        </div>
        <Button variant="subtle" size="sm" onClick={() => setDate(dhakaDate())}>
          Today
        </Button>
        <p className="text-sm text-ink-muted">
          {formatDateLong(`${date}T12:00:00+06:00`)} · <span className="font-semibold text-ink">{covers}</span> covers confirmed
        </p>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <Input placeholder="Name, phone, reference…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-10 pl-9 text-sm" />
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              filter === f.key ? "border-forest-600 bg-forest-600 text-cream-50" : "border-line bg-surface text-ink-muted hover:text-ink",
            )}
          >
            {f.label}
            <span className={cn("rounded-full px-1.5 text-xs tabular-nums", filter === f.key ? "bg-cream-50/20" : "bg-surface-2")}>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-sm bg-surface-2" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-sm border border-dashed border-line p-12 text-center text-sm text-ink-muted">No reservations match.</div>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => (
            <ReservationRow
              key={r.id}
              r={r}
              areas={areas}
              tables={tables}
              expanded={expanded === r.id}
              onToggle={() => setExpanded((e) => (e === r.id ? null : r.id))}
              onChanged={load}
            />
          ))}
        </ul>
      )}

      {waiting.length > 0 ? (
        <section className="rounded-sm border border-line bg-surface p-5">
          <h2 className="font-display text-2xl text-ink">Waitlist · {waiting.length}</h2>
          <p className="mt-1 text-xs text-ink-muted">Guests are promoted automatically (oldest first) when a pending or confirmed booking frees up seats.</p>
          <ul className="mt-4 divide-y divide-line text-sm">
            {waiting.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-20 font-semibold tabular-nums">{formatTime(w.starts_at)}</span>
                <span className="flex-1">
                  {w.customer_name} · {w.party_size}
                  {w.large_party ? "+" : ""} guests · {areas.find((a) => a.id === w.area_id)?.name_en}
                </span>
                <a href={`tel:${w.phone}`} className="text-ink-muted hover:text-ink">
                  {w.phone}
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const res = await setWaitlistStatus(w.id, "cancelled");
                    if (!res.ok) toast.error(res.error);
                    else load();
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ReservationRow({
  r,
  areas,
  tables,
  expanded,
  onToggle,
  onChanged,
}: {
  r: AdminReservation;
  areas: Area[];
  tables: DiningTable[];
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(r.staff_notes ?? "");
  const [selectedTables, setSelectedTables] = useState<string[]>(r.tables.map((t) => t.id));

  useEffect(() => setNotes(r.staff_notes ?? ""), [r.staff_notes]);
  const tableKey = r.tables.map((t) => t.id).join(",");
  useEffect(() => setSelectedTables(tableKey ? tableKey.split(",") : []), [tableKey]);

  const run = (fn: () => Promise<ActionResult>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(success);
        onChanged();
      }
    });

  const change = (status: ReservationStatus, success: string, askReason = false) => {
    let reason: string | undefined;
    if (askReason) {
      const input = window.prompt("Reason (shared with the guest in their email, optional):", "");
      if (input === null) return;
      reason = input;
    }
    run(() => setReservationStatus(r.id, status, reason), success);
  };

  const flags: React.ReactNode[] = [];
  if (r.history.visits > 0) flags.push(<Badge key="ret" tone="forest">Returning ×{r.history.visits}</Badge>);
  if (r.history.no_shows > 0) flags.push(<Badge key="ns" tone="danger">No-show ×{r.history.no_shows}</Badge>);
  if (r.history.cancellations > 1) flags.push(<Badge key="cx" tone="timber">Cancelled ×{r.history.cancellations}</Badge>);
  if (r.large_party) flags.push(<Badge key="lg" tone="gold">10+ party</Badge>);
  if (r.source === "waitlist") flags.push(<Badge key="wl" tone="blue">From waitlist</Badge>);
  if (r.pre_order && r.pre_order.status !== "cancelled")
    flags.push(
      <Badge key="po" tone="gold">
        <Utensils className="size-2.5" /> Pre-order {formatPrice(Number(r.pre_order.total))}
      </Badge>,
    );
  if (r.last_email?.status === "failed") flags.push(<Badge key="em" tone="danger">Email failed</Badge>);

  const cancelRequested = Boolean(r.cancel_requested_at) && ["pending", "confirmed"].includes(r.status);

  return (
    <li className={cn("rounded-sm border bg-surface", cancelRequested ? "border-red-300" : r.status === "pending" ? "border-gold-400/60" : "border-line")}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
        <div className="w-24 shrink-0">
          <p className="font-display text-2xl leading-none text-ink tabular-nums">{formatTime(r.starts_at)}</p>
          <p className="mt-1 text-xs text-ink-muted">to {formatTime(r.ends_at)}</p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink">{r.customer_name}</p>
            <span className="text-sm text-ink-muted">
              · {r.party_size}
              {r.large_party ? "+" : ""} guests · {r.area.name}
              {r.tables.length ? ` · ${r.tables.map((t) => t.label).join(", ")}` : ""}
            </span>
            <StatusBadge status={r.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs text-ink-muted">{r.reference}</span>
            {flags}
            {r.status === "pending" && r.expires_at ? <span className="text-xs text-gold-600">· hold expires {relativeFromNow(r.expires_at)}</span> : null}
          </div>
          {cancelRequested ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-800">
              <AlertTriangle className="size-3.5" /> Guest requested cancellation {relativeFromNow(r.cancel_requested_at!)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button asChild variant="outline" size="sm">
            <a href={`tel:${r.phone}`}>
              <Phone /> {r.phone.replace(/^\+88/, "")}
            </a>
          </Button>

          {cancelRequested ? (
            <>
              <Button size="sm" variant="danger" disabled={pending} onClick={() => change("cancelled", "Cancelled — guest emailed", false)}>
                <X /> Approve cancel
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => dismissCancelRequest(r.id), "Request dismissed")}>
                Dismiss
              </Button>
            </>
          ) : null}

          {r.status === "pending" ? (
            <>
              <Button size="sm" disabled={pending} onClick={() => change("confirmed", "Confirmed — email with pre-order link queued")}>
                <Check /> Confirm
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => change("rejected", "Rejected — guest emailed", true)}>
                <Ban /> Reject
              </Button>
            </>
          ) : null}
          {r.status === "confirmed" && !cancelRequested ? (
            <>
              <Button size="sm" disabled={pending} onClick={() => change("seated", "Marked as seated")}>
                <UserCheck /> Seat
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => change("no_show", "Marked as no-show")}>
                No-show
              </Button>
            </>
          ) : null}
          {r.status === "seated" ? (
            <Button size="sm" variant="subtle" disabled={pending} onClick={() => change("completed", "Marked as completed")}>
              <Check /> Complete
            </Button>
          ) : null}

          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label="Details"
            className="inline-flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="grid gap-6 border-t border-line p-4 text-sm lg:grid-cols-3">
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Guest</p>
            <p>
              <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1.5 text-ink hover:underline">
                <Mail className="size-3.5" /> {r.email}
              </a>
            </p>
            <p className="text-ink-muted">
              {r.history.bookings} previous booking{r.history.bookings === 1 ? "" : "s"} · {r.history.visits} visits · {r.history.no_shows} no-shows
            </p>
            <p className="text-ink-muted">Language: {r.locale === "bn" ? "Bangla" : "English"}</p>
            {r.special_requests ? (
              <div className="rounded-sm bg-surface-2 p-3">
                <p className="text-xs font-semibold text-ink-muted">Special requests</p>
                <p className="mt-1 text-ink">{r.special_requests}</p>
              </div>
            ) : null}
            {r.cancel_reason ? <p className="text-ink-muted">Reason: {r.cancel_reason}</p> : null}
            <div className="flex flex-wrap gap-2 pt-1">
              {["pending", "confirmed"].includes(r.status) ? (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => resendEmail(r.id), "Email re-sent")}>
                  <RotateCcw /> Resend {r.status === "confirmed" ? "confirmation" : "receipt"}
                </Button>
              ) : null}
              {["pending", "confirmed"].includes(r.status) && !cancelRequested ? (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => change("cancelled", "Cancelled — guest emailed", true)}>
                  <X /> Cancel booking
                </Button>
              ) : null}
            </div>
            {r.last_email ? (
              <p className="text-xs text-ink-muted">
                Last email: {r.last_email.kind} · {r.last_email.status} · {relativeFromNow(r.last_email.at)}
                {r.last_email.error ? <span className="block text-red-800">{r.last_email.error}</span> : null}
              </p>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Tables</p>
            <div className="mt-3 space-y-3">
              {areas.map((a) => {
                const areaTables = tables.filter((t) => t.area_id === a.id && t.is_active);
                if (!areaTables.length) return null;
                return (
                  <div key={a.id}>
                    <p className="text-xs text-ink-muted">{a.name_en}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {areaTables.map((t) => {
                        const on = selectedTables.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setSelectedTables((s) => (on ? s.filter((x) => x !== t.id) : [...s, t.id]))}
                            className={cn(
                              "rounded-sm border px-2 py-1 text-xs",
                              on ? "border-forest-600 bg-forest-600 text-cream-50" : "border-line text-ink hover:border-ink/40",
                            )}
                          >
                            {t.label} · {t.seats}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <Button size="sm" variant="outline" className="mt-3" disabled={pending} onClick={() => run(() => assignTables(r.id, selectedTables), "Tables saved")}>
              Save tables
            </Button>
          </div>

          <div>
            <label htmlFor={`notes-${r.id}`} className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
              Staff notes
            </label>
            <Textarea id={`notes-${r.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className="mt-3 min-h-28 text-sm" placeholder="Called at 3pm, prefers window seat…" />
            <Button size="sm" variant="outline" className="mt-3" disabled={pending} onClick={() => run(() => updateStaffNotes(r.id, notes), "Notes saved")}>
              Save notes
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
