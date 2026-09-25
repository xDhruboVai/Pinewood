"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/types";

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const noon = (day: string) => `${day}T12:00:00+06:00`;

/**
 * The booking form's date field: a button like the other fields that opens a small month calendar.
 * Only the dates in `available` (open days in the booking window) can be picked; `today` is outlined.
 * Dates are "YYYY-MM-DD" strings in Dhaka time.
 */
export function DatePicker({
  id,
  value,
  onChange,
  available,
  today,
  locale,
  labels,
}: {
  id: string;
  value: string;
  onChange: (day: string) => void;
  available: string[];
  today: string;
  locale: Locale;
  labels: { prev: string; next: string };
}) {
  const [open, setOpen] = useState(false);
  const [year, month] = value.split("-").map(Number);
  const [view, setView] = useState({ y: year, m: month - 1 });
  const wrap = useRef<HTMLDivElement>(null);
  const allowed = useMemo(() => new Set(available), [available]);

  // First and last month with a bookable day, so the arrows stop there.
  const first = available[0] ?? value;
  const last = available[available.length - 1] ?? value;
  const monthKey = (y: number, m: number) => y * 12 + m;
  const minKey = monthKey(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 1);
  const maxKey = monthKey(Number(last.slice(0, 4)), Number(last.slice(5, 7)) - 1);
  const viewKey = monthKey(view.y, view.m);

  useEffect(() => {
    if (open) setView({ y: year, m: month - 1 });
  }, [open, year, month]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shift = (n: number) => {
    const k = viewKey + n;
    setView({ y: Math.floor(k / 12), m: k % 12 });
  };

  const lead = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  // Weekday initials, Sunday first (2026-09-20 is a Sunday).
  const weekdays = Array.from({ length: 7 }, (_, i) => formatDate(noon(`2026-09-${20 + i}`), locale, { weekday: "short", day: undefined, month: undefined }));

  return (
    <div ref={wrap} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-full items-center justify-between rounded-sm border border-line bg-surface px-3.5 text-left text-[0.95rem] text-ink transition-colors hover:border-ink/35 focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
      >
        {formatDate(noon(value), locale, { weekday: "long", month: "long" })}
        <svg aria-hidden viewBox="0 0 20 20" fill="none" className="size-4 text-ink-muted">
          <rect x="3" y="4.5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M3 8.5h14M7 2.8v3.2M13 2.8v3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div role="dialog" aria-label={formatDate(noon(value), locale, { weekday: undefined, day: undefined, month: "long" })} className="absolute top-full left-0 z-30 mt-2 w-[19rem] rounded-sm border border-line bg-canvas p-4 shadow-[0_12px_32px_-16px_rgba(20,40,40,0.35)]">
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label={labels.prev}
              disabled={viewKey <= minKey}
              onClick={() => shift(-1)}
              className="inline-flex size-8 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
            >
              <ChevronLeft className="size-4" strokeWidth={1.5} />
            </button>
            <p className="text-[0.85rem] font-semibold tracking-[0.06em] text-ink uppercase">
              {formatDate(noon(iso(view.y, view.m, 1)), locale, { weekday: undefined, day: undefined, month: "long", year: "numeric" })}
            </p>
            <button
              type="button"
              aria-label={labels.next}
              disabled={viewKey >= maxKey}
              onClick={() => shift(1)}
              className="inline-flex size-8 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
            >
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center">
            {weekdays.map((w) => (
              <span key={w} className="py-1 text-[0.7rem] font-medium text-ink-muted">
                {w.slice(0, 2)}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const day = iso(view.y, view.m, i + 1);
              const can = allowed.has(day);
              const on = day === value;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={!can}
                  aria-pressed={on}
                  aria-label={formatDate(noon(day), locale, { weekday: "long", month: "long" })}
                  onClick={() => {
                    onChange(day);
                    setOpen(false);
                  }}
                  className={cn(
                    "h-9 rounded-sm text-[0.9rem] tabular-nums transition-colors",
                    on
                      ? "bg-primary font-semibold text-primary-ink"
                      : can
                        ? cn("text-ink hover:bg-surface-2", day === today && "ring-1 ring-ink/30 ring-inset")
                        : "cursor-not-allowed text-ink-muted/35",
                  )}
                >
                  {formatNumber(i + 1, locale)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
