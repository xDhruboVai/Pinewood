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
 * Reads the hour box (1-12) after a keystroke, given the hour that was there before. Tapping the box
 * pre-fills "7" for the wheel; a digit typed next to it (before or after, depending on where the
 * cursor sat) starts a new hour instead of making "79" or "97". Typing "1" then "0" still gives 10,
 * and a 24-hour value like "19" gives 7 pm.
 */
export function readHour(raw: string, prev = ""): { hour: string; ampm?: AmPm } {
  const d = raw.replace(/\D/g, "").slice(0, 2);
  if (d === "") return { hour: "" };
  const asHour = (v: string): { hour: string; ampm?: AmPm } => {
    const k = Number(v);
    if (k >= 1 && k <= 12) return { hour: String(k) };
    if (v.length === 2 && k >= 13 && k <= 23) return { hour: String(k - 12), ampm: "pm" };
    return { hour: "" };
  };
  // One digit typed next to a one-digit hour.
  if (d.length === 2 && prev.length === 1) {
    if (d === prev + d[1]) {
      const two = asHour(d); // after it: 1 -> 10, 11, 12, or 24-hour 13-19
      return two.hour ? two : asHour(d[1]);
    }
    if (d === d[0] + prev) return asHour(d[0]); // before it: a new hour
  }
  const whole = asHour(d);
  return whole.hour ? whole : asHour(d.slice(-1));
}

/** Minutes 00-59; a typed value over 59 keeps the last digit. */
export function readMinute(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(-2);
  return d.length === 2 && Number(d) > 59 ? d.slice(-1) : d;
}

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
  // Tapping or tabbing into a box selects its value, so the digit typed next replaces it.
  const selectAll = (e: React.FocusEvent<HTMLInputElement>) => {
    openWheel();
    const el = e.currentTarget;
    requestAnimationFrame(() => el.select());
  };
  // The mouse-up that ends a tap would otherwise drop that selection.
  const keepSelection = (e: React.MouseEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    if (el.value && el.selectionStart === 0 && el.selectionEnd === el.value.length) e.preventDefault();
  };
  // Keyboard: "a" or "p" in either box sets AM or PM.
  const onAmPmKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const k = e.key.toLowerCase();
    if (k === "a" || k === "p") {
      e.preventDefault();
      onAmpm(k === "a" ? "am" : "pm");
    }
  };

  const openWheel = () => {
    if (open) return;
    before.current = { hour, minute, ampm };
    // Start the wheel on a sensible time if nothing is typed yet. A typed time is left as it is, even
    // one the wheel doesn't list (7:15): the form says why it can't be booked instead of changing it.
    if (!hour) {
      onHour("7");
      if (!MINUTES.includes(minute)) onMinute("00");
    }
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
      if (e.key === "Enter") {
        // Enter confirms the time; it shouldn't also send the whole booking form.
        e.preventDefault();
        setOpen(false);
      }
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
            onFocus={selectAll}
            onMouseUp={keepSelection}
            onChange={(e) => {
              const next = readHour(e.target.value, hour);
              onHour(next.hour);
              if (next.ampm) onAmpm(next.ampm);
            }}
            onKeyDown={onAmPmKey}
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
            onFocus={selectAll}
            onMouseUp={keepSelection}
            onChange={(e) => onMinute(readMinute(e.target.value))}
            onKeyDown={onAmPmKey}
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
