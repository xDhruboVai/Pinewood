"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type AmPm = "am" | "pm";
const ROW = 40; // px, height of one wheel row
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
// The booking system only takes times on the hour or half hour, so the wheel only offers those.
const MINUTES = ["00", "30"];
const AMPM: AmPm[] = ["am", "pm"];

/**
 * The booking form's time field. Hour and minutes can be typed (digits only) or picked on a wheel
 * that opens under the field: three scrolling columns (hour, minute, AM/PM) with the chosen row in a
 * band across the middle, and Cancel / OK. Times with no free table (`free`, "h:mm am") are faded.
 */
export function TimePicker({
  id,
  hour,
  minute,
  ampm,
  onHour,
  onMinute,
  onAmpm,
  free,
  invalid,
  labels,
}: {
  id: string;
  hour: string;
  minute: string;
  ampm: AmPm;
  onHour: (v: string) => void;
  onMinute: (v: string) => void;
  onAmpm: (v: AmPm) => void;
  free: Set<string>;
  invalid?: boolean;
  labels: { hour: string; minute: string; ampm: string; clear: string; cancel: string; ok: string };
}) {
  const [open, setOpen] = useState(false);
  const before = useRef({ hour, minute, ampm });
  const wrap = useRef<HTMLDivElement>(null);
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 2);

  const openWheel = () => {
    if (open) return;
    before.current = { hour, minute, ampm };
    // Start the wheel on a sensible time if nothing is typed yet.
    if (!hour) onHour("7");
    if (!MINUTES.includes(minute)) onMinute("00");
    setOpen(true);
  };
  const cancel = () => {
    onHour(before.current.hour);
    onMinute(before.current.minute);
    onAmpm(before.current.ampm);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
      if (e.key === "Enter") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const hourFree = (h: string, ap: AmPm) => MINUTES.some((m) => free.has(`${h}:${m} ${ap}`));

  return (
    <div ref={wrap} className="relative">
      <div
        onClick={openWheel}
        className={cn(
          "flex h-12 cursor-text items-center gap-3 rounded-sm border bg-surface pr-2 pl-3.5 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30",
          invalid ? "border-danger" : open ? "border-accent" : "border-line",
        )}
      >
        <svg aria-hidden viewBox="0 0 20 20" fill="none" className="size-4 shrink-0 text-ink-muted">
          <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M10 6v4.3l2.8 1.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="flex items-center text-[0.95rem] text-ink tabular-nums">
          <input
            id={id}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="7"
            aria-label={labels.hour}
            value={hour}
            onFocus={openWheel}
            onChange={(e) => onHour(digits(e.target.value))}
            aria-invalid={invalid}
            className="w-6 bg-transparent text-right placeholder:text-ink-muted/60 focus:outline-none"
          />
          <span aria-hidden className="px-0.5 text-ink-muted">
            :
          </span>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="00"
            aria-label={labels.minute}
            value={minute}
            onFocus={openWheel}
            onChange={(e) => onMinute(digits(e.target.value))}
            onBlur={() => minute.length === 1 && onMinute(`0${minute}`)}
            aria-invalid={invalid}
            className="w-6 bg-transparent placeholder:text-ink-muted/60 focus:outline-none"
          />
          <span className="ml-2 text-[0.8rem] font-semibold tracking-[0.08em] text-ink-muted uppercase">{ampm}</span>
        </span>
        {hour ? (
          <button
            type="button"
            aria-label={labels.clear}
            onClick={(e) => {
              e.stopPropagation();
              onHour("");
              onMinute("00");
              setOpen(false);
            }}
            className="ml-auto inline-flex size-8 items-center justify-center rounded-sm text-ink-muted hover:text-ink"
          >
            <svg aria-hidden viewBox="0 0 20 20" fill="none" className="size-3.5">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          role="dialog"
          aria-label={labels.hour}
          className="absolute top-full right-0 left-0 z-30 mt-2 min-w-[17rem] rounded-sm border border-line bg-canvas px-4 pt-3 pb-2 shadow-[0_12px_32px_-16px_rgba(20,40,40,0.35)]"
        >
          <div className="relative flex justify-center gap-2">
            {/* The band across the middle row */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-10 -translate-y-1/2 rounded-sm bg-surface-2/80" />
            <Wheel label={labels.hour} items={HOURS} value={String(Number(hour) || 7)} onChange={onHour} faded={(h) => !hourFree(h, ampm)} />
            <Wheel label={labels.minute} items={MINUTES} value={MINUTES.includes(minute) ? minute : "00"} onChange={onMinute} faded={(m) => !free.has(`${Number(hour) || 7}:${m} ${ampm}`)} />
            <Wheel label={labels.ampm} items={AMPM} value={ampm} onChange={(v) => onAmpm(v as AmPm)} faded={(ap) => !HOURS.some((h) => hourFree(h, ap as AmPm))} caps />
          </div>
          <div className="mt-2 flex justify-end gap-6 pr-1">
            <button type="button" onClick={cancel} className="py-2 text-[0.75rem] font-semibold tracking-[0.12em] text-ink-muted uppercase hover:text-ink">
              {labels.cancel}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="py-2 text-[0.75rem] font-semibold tracking-[0.12em] text-primary uppercase hover:text-accent-ink">
              {labels.ok}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** One scrolling column. The row in the middle is the value; scroll, swipe or click a row to pick it. */
function Wheel({
  label,
  items,
  value,
  onChange,
  faded,
  caps,
}: {
  label: string;
  items: string[];
  value: string;
  onChange: (v: string) => void;
  faded: (v: string) => boolean;
  caps?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const index = Math.max(0, items.indexOf(value));

  // Keep the column on the current value (on open, and when the value is typed).
  useEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ROW) !== index) el.scrollTo({ top: index * ROW });
  }, [index]);

  const onScroll = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)));
      if (items[i] !== value) onChange(items[i]);
    }, 90);
  };

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      onScroll={onScroll}
      className="no-scrollbar relative h-[200px] w-16 snap-y snap-mandatory overflow-y-auto overscroll-contain"
      style={{ paddingBlock: ROW * 2 }}
    >
      {items.map((it) => {
        const on = it === value;
        return (
          <button
            key={it}
            type="button"
            role="option"
            aria-selected={on}
            onClick={() => {
              onChange(it);
              ref.current?.scrollTo({ top: items.indexOf(it) * ROW, behavior: "smooth" });
            }}
            className={cn(
              "relative block h-10 w-full snap-center text-center tabular-nums transition-colors",
              caps && "text-[0.85rem] tracking-[0.08em] uppercase",
              on ? "text-[1.35rem] font-semibold text-primary" : "text-[1.05rem] text-ink-muted hover:text-ink",
              on && caps && "text-[1rem]",
              faded(it) && !on && "opacity-35",
            )}
          >
            {it}
          </button>
        );
      })}
    </div>
  );
}
