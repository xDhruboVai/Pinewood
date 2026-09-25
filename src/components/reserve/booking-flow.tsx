"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { holdSlot, submitReservation } from "@/actions/reservation";
import { Button } from "@/components/ui/button";
import { QuietLink } from "@/components/site/section";
import { Field, Input, Label, Textarea } from "@/components/ui/form";
import { DatePicker } from "./date-picker";
import { TimePicker } from "./time-picker";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/client";
import { dhakaDate, formatDate, formatNumber, formatTime, isoToDhakaTime } from "@/lib/format";
import { SITE, visibleOutlets } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { Area, AvailabilitySlot, ScheduleDay } from "@/lib/types";

type Seating = "inside" | "outside";

const DAYS_AHEAD = 31;

/** Areas that count as "outside" (the smoking zone). Everything else is inside (non-smoking). */
const isOutside = (a: Area) => /outdoor|outside|rooftop|balcony|terrace|smok/i.test(`${a.slug} ${a.name_en}`);

/**
 * One short form: name, phone, email, branch, inside or outside, number of people, date and time,
 * and a note. The booking system has one pool of seats and doesn't know branches or smoking zones
 * yet, so both travel to staff as the first lines of the booking notes. Seats are held only when
 * the form is sent, in the matching area with the most free seats at that time.
 */
export function BookingFlow({ areas }: { areas: Area[] }) {
  const { locale, t } = useI18n();
  const supabase = useMemo(() => createClient(), []);

  const outlets = visibleOutlets();
  const [outletSlug, setOutletSlug] = useState(outlets[0]?.slug ?? "");
  const outlet = outlets.find((o) => o.slug === outletSlug);
  const [seating, setSeating] = useState<Seating>("inside");
  const [party, setParty] = useState(2);
  const dates = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => dhakaDate(i)), []);
  const [date, setDate] = useState(dates[0]);
  // The time is typed: hour and minute (digits only) plus AM/PM.
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("00");
  const [ampm, setAmpm] = useState<"am" | "pm">("pm");
  const duration: number = SITE.booking.defaultDuration;

  const [schedule, setSchedule] = useState<Record<string, ScheduleDay>>({});
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", phone: "", email: "", note: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ reference: string; phone: string } | null>(null);

  // Areas for the chosen seating. If the database has none of that kind, any active area will do:
  // staff still see the choice in the notes.
  const areaIds = useMemo(() => {
    const active = areas.filter((a) => a.is_active);
    const matching = active.filter((a) => (seating === "outside" ? isOutside(a) : !isOutside(a)));
    return new Set((matching.length ? matching : active).map((a) => a.id));
  }, [areas, seating]);

  useEffect(() => {
    supabase.rpc("get_schedule", { p_days: DAYS_AHEAD }).then(({ data }) => {
      const map: Record<string, ScheduleDay> = {};
      for (const d of (data ?? []) as ScheduleDay[]) map[d.day] = d;
      setSchedule(map);
      const firstOpen = dates.find((d) => map[d]?.opens);
      if (firstOpen && !map[dates[0]]?.opens) setDate(firstOpen);
    });
  }, [supabase, dates]);

  const fetchSlots = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_availability", { p_date: date, p_party_size: party, p_duration_minutes: duration });
    if (!error) setSlots((data ?? []) as AvailabilitySlot[]);
    setLoading(false);
  }, [supabase, date, party, duration]);

  const fetchRef = useRef(fetchSlots);
  fetchRef.current = fetchSlots;

  useEffect(() => {
    setLoading(true);
    fetchSlots();
  }, [fetchSlots]);

  // Live updates: the database broadcasts a ping whenever capacity changes.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel("availability")
      .on("broadcast", { event: "changed" }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => fetchRef.current(), 400);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // One entry per time: the matching area with the most free seats (or a full one, shown as full).
  const times = useMemo(() => {
    const byStart = new Map<string, AvailabilitySlot[]>();
    for (const s of slots) {
      if (!areaIds.has(s.area_id)) continue;
      byStart.set(s.slot_start, [...(byStart.get(s.slot_start) ?? []), s]);
    }
    return [...byStart.values()]
      .map((group) => group.filter((s) => s.available).sort((a, b) => b.remaining - a.remaining)[0] ?? group[0])
      .sort((a, b) => a.slot_start.localeCompare(b.slot_start));
  }, [slots, areaIds]);

  // Turn the typed time into a start time and check it: a real time, on the hour or half hour
  // (the booking system only takes those), inside opening hours and not full.
  const h = Number(hour);
  const m = Number(minute || "0");
  const typedValid = hour !== "" && h >= 1 && h <= 12 && m >= 0 && m <= 59;
  const startMs = typedValid
    ? new Date(`${date}T${String((h % 12) + (ampm === "pm" ? 12 : 0)).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+06:00`).getTime()
    : NaN;
  const match = times.find((s) => new Date(s.slot_start).getTime() === startMs);
  const chosen = match?.available ? match : undefined;
  const timeProblem = !typedValid
    ? t.reserve.timeInvalid
    : m % 30 !== 0
      ? t.reserve.timeHalfHour
      : !match
        ? t.reserve.timeUnavailable
        : !match.available
          ? t.reserve.timeFull
          : "";
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 2);

  // Earliest and latest start times with a free table, shown as a hint under the time.
  const freeTimes = times.filter((s) => s.available);
  const firstTime = freeTimes[0]?.slot_start;
  const lastTime = freeTimes[freeTimes.length - 1]?.slot_start;
  // Free times as "7:30 pm" keys, so the time wheel can fade the ones with no table.
  const freeKeys = useMemo(
    () =>
      new Set(
        freeTimes.map((slot) => {
          const [hh, mm] = isoToDhakaTime(slot.slot_start).split(":").map(Number);
          return `${hh % 12 || 12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "am" : "pm"}`;
        }),
      ),
    [freeTimes],
  );

  const openDates = dates.filter((d) => Object.keys(schedule).length === 0 || schedule[d]?.opens);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = (k: string) => errors[k];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!chosen) {
      setErrors({ time: hour === "" ? t.reserve.timeRequired : timeProblem });
      return;
    }
    startTransition(async () => {
      const hold = await holdSlot({ areaId: chosen.area_id, start: chosen.slot_start, duration, partySize: party });
      if (!hold.ok) {
        toast.error(t.errors[hold.error] ?? t.errors.generic);
        fetchSlots();
        return;
      }
      // Staff see the branch and seating first in the booking notes.
      const notes = [
        outlets.length > 1 && outlet ? `Branch: ${outlet.name.en}` : "",
        `Seating: ${seating === "outside" ? "Outside (smoking)" : "Inside (non-smoking)"}`,
        form.note.trim(),
      ]
        .filter(Boolean)
        .join("\n");
      const res = await submitReservation({
        name: form.name,
        phone: form.phone,
        email: form.email,
        requests: notes,
        largeParty: false,
        consent: true,
        website: form.website,
        locale,
        holdId: hold.data.holdId,
      });
      if (!res.ok) {
        if ("fields" in res && res.fields) {
          setErrors(Object.fromEntries(Object.entries(res.fields).map(([k, v]) => [k, t.errors[v] ?? t.errors.generic])));
        }
        toast.error(t.errors[res.error] ?? t.errors.generic);
        return;
      }
      setResult({ reference: res.data.reference, phone: res.data.phone });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  if (result) {
    return (
      <div className="max-w-2xl">
        <h2 className="display text-4xl text-ink sm:text-5xl">{t.reserve.doneTitle}</h2>
        <p className="mt-4 max-w-xl leading-relaxed text-ink-muted">{t.reserve.doneBody(result.phone)}</p>
        <p className="mt-6 text-ink-muted">
          {t.reserve.reference}: <span className="text-lg font-semibold tracking-wider text-ink">{result.reference}</span>
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Button
            onClick={() => {
              setResult(null);
              setHour("");
              setForm((f) => ({ ...f, note: "" }));
              fetchSlots();
            }}
          >
            {t.reserve.another}
          </Button>
          <QuietLink href="/menu">{t.nav.menu}</QuietLink>
        </div>
      </div>
    );
  }

  const timeLabel = chosen ? formatTime(chosen.slot_start, locale) : t.reserve.pickTime;
  const summary = [
    formatDate(`${date}T12:00:00+06:00`, locale, { weekday: "long", month: "long" }),
    timeLabel,
    `${formatNumber(party, locale)} ${party === 1 ? t.common.guest : t.common.guests}`,
    outlets.length > 1 && outlet ? outlet.name[locale] : null,
    seating === "outside" ? t.reserve.outside : t.reserve.inside,
  ]
    .filter(Boolean)
    .join(" · ");
  // Step numbers shift by one when there is only one branch to choose from.
  const n = (step: number) => (outlets.length > 1 || step < 2 ? step : step - 1);

  return (
    <form onSubmit={submit} noValidate>
      {/* 1. Your details */}
      <Step n={1} title={t.reserve.detailsTitle} hint={t.reserve.detailsHint} first>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t.reserve.name} htmlFor="name" error={err("name")}>
            <Input id="name" autoComplete="name" required value={form.name} onChange={set("name")} aria-invalid={!!err("name")} className="h-12" />
          </Field>
          <Field label={t.reserve.phone} htmlFor="phone" error={err("phone")}>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="01XXXXXXXXX"
              required
              value={form.phone}
              onChange={set("phone")}
              aria-invalid={!!err("phone")}
              className="h-12"
            />
          </Field>
          <Field label={t.reserve.email} htmlFor="email" error={err("email")}>
            <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} aria-invalid={!!err("email")} className="h-12" />
          </Field>
        </div>
      </Step>

      {/* 2. Branch */}
      {outlets.length > 1 ? (
        <Step n={2} title={t.reserve.outlet}>
          <Choice
            label={t.reserve.outlet}
            value={outletSlug}
            onChange={setOutletSlug}
            options={outlets.map((o) => ({ value: o.slug, title: o.name[locale], hint: o.address[locale] }))}
          />
        </Step>
      ) : null}

      {/* 3. Inside or outside */}
      <Step n={n(3)} title={t.reserve.seating}>
        <Choice
          label={t.reserve.seating}
          value={seating}
          onChange={(v) => setSeating(v as Seating)}
          options={[
            { value: "inside", title: t.reserve.inside, hint: t.reserve.insideHint },
            { value: "outside", title: t.reserve.outside, hint: t.reserve.outsideHint },
          ]}
        />
      </Step>

      {/* 4. Number of people */}
      <Step n={n(4)} title={t.reserve.partySize} hint={t.reserve.largePartyCall}>
        <div role="radiogroup" aria-label={t.reserve.partySize} className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {Array.from({ length: SITE.booking.maxOnlineParty }, (_, i) => i + 1).map((count) => (
            <button
              key={count}
              type="button"
              role="radio"
              aria-checked={party === count}
              onClick={() => setParty(count)}
              className={cn(
                "h-12 rounded-sm border text-[0.95rem] font-medium tabular-nums transition-colors",
                party === count ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink hover:border-ink/35",
              )}
            >
              {formatNumber(count, locale)}
            </button>
          ))}
        </div>
      </Step>

      {/* 5. Date and time */}
      <Step n={n(5)} title={t.reserve.when}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.reserve.date} htmlFor="date">
            <DatePicker
              id="date"
              value={date}
              onChange={setDate}
              available={openDates}
              today={dates[0]}
              locale={locale}
              labels={{ prev: t.reserve.prevMonth, next: t.reserve.nextMonth }}
            />
          </Field>
          <div>
            <Label htmlFor="time">{t.reserve.time}</Label>
            <TimePicker
              id="time"
              hour={hour}
              minute={minute}
              ampm={ampm}
              onHour={setHour}
              onMinute={setMinute}
              onAmpm={setAmpm}
              free={freeKeys}
              invalid={!!err("time")}
              labels={{ hour: t.reserve.hour, minute: t.reserve.minute, ampm: t.reserve.ampm, clear: t.reserve.clearTime, cancel: t.reserve.cancel, ok: t.reserve.ok }}
            />
          </div>
          <div className="sm:col-span-2">
            {err("time") ? (
              <p role="alert" className="text-sm text-danger">
                {err("time")}
              </p>
            ) : hour !== "" && !loading && timeProblem ? (
              <p className="text-sm text-accent-ink">{timeProblem}</p>
            ) : !loading && times.length === 0 ? (
              <p className="text-sm text-ink-muted">
                {t.reserve.noSlots}{" "}
                <a className="font-medium text-primary evening:text-ink" href={`tel:${SITE.phones[0].tel}`}>
                  {SITE.phones[0].display}
                </a>
              </p>
            ) : (
              <p className="text-sm text-ink-muted">
                {firstTime && lastTime ? t.reserve.timeRange(formatTime(firstTime, locale), formatTime(lastTime, locale)) : t.reserve.timeHalfHour}
              </p>
            )}
          </div>
        </div>
      </Step>

      {/* 6. Note */}
      <Step n={n(6)} title={t.reserve.note}>
        <Textarea
          id="note"
          aria-label={t.reserve.note}
          maxLength={400}
          value={form.note}
          onChange={set("note")}
          placeholder={t.reserve.notePlaceholder}
          className="min-h-28"
        />
      </Step>

      {/* Honeypot for bots */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
      </div>

      {/* 7. Confirm */}
      <Step n={n(7)} title={t.reserve.confirmTitle} hint={t.reserve.confirmHint}>
        <p className="text-[1.1rem] leading-relaxed font-medium text-ink" aria-live="polite">
          {summary}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
            {pending ? t.reserve.submitting : t.reserve.submit}
          </Button>
          <p className="max-w-md text-xs leading-relaxed text-ink-muted">
            {t.reserve.consentNote}{" "}
            <Link href="/privacy" target="_blank" className="font-medium text-primary evening:text-ink">
              {t.reserve.privacyLink}
            </Link>
          </p>
        </div>
      </Step>
    </form>
  );
}

/**
 * One step of the form, laid out like the menu: a small serif number and the step name (in the
 * menu's dish-name style) on the left, the controls on the right, a thin line between steps.
 */
function Step({ n, title, hint, first, children }: { n: number; title: string; hint?: string; first?: boolean; children: React.ReactNode }) {
  return (
    <section className={cn("grid gap-x-12 gap-y-5 py-10 lg:grid-cols-12", first ? "pt-0" : "border-t border-line")}>
      <div className="lg:col-span-4">
        <p aria-hidden className="label text-accent-ink tabular-nums">
          {String(n).padStart(2, "0")}
        </p>
        <h2 className="mt-2 text-[0.95rem] font-semibold tracking-[0.03em] text-ink uppercase">{title}</h2>
        {hint ? <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-muted">{hint}</p> : null}
      </div>
      <div className="lg:col-span-8">{children}</div>
    </section>
  );
}

/** Equal tiles for a single choice (branch, inside or outside); the chosen one is filled teal. */
function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; title: string; hint?: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-3 sm:grid-cols-3">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-h-[4.75rem] flex-col justify-center rounded-sm border px-4 py-3 text-left transition-colors",
              on ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink hover:border-ink/35",
            )}
          >
            <span className="text-[0.85rem] font-semibold tracking-[0.03em] uppercase">{o.title}</span>
            {o.hint ? <span className={cn("mt-1 text-[0.8rem] leading-snug", on ? "text-primary-ink/75" : "text-ink-muted")}>{o.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
