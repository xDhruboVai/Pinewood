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
import { composeBookingNotes } from "@/lib/booking-notes";
import { useI18n } from "@/lib/i18n/client";
import { dhakaDate, formatDate, formatNumber, formatTime, isoToDhakaTime, normalizePhone } from "@/lib/format";
import { SITE, visibleOutlets } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { Area, AvailabilitySlot, Branch, ScheduleDay, Seating } from "@/lib/types";

const DAYS_AHEAD = 31;
/** Pause after the date, party size or branch changes before asking for free times (8 → 9 → 10 asks once). */
const SLOTS_DEBOUNCE_MS = 250;

/** Arrow keys (and Home/End) move between the options of a radio group, like native radio buttons. */
function radioKeys(e: React.KeyboardEvent<HTMLElement>) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (step === undefined && e.key !== "Home" && e.key !== "End") return;
  const radios = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  const i = radios.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  const next = e.key === "Home" ? 0 : e.key === "End" ? radios.length - 1 : (i + step! + radios.length) % radios.length;
  radios[next].focus();
  radios[next].click();
}

/** Outside = the smoking zone. The area's seating column decides; older data falls back to its name. */
const isOutside = (a: Area) => (a.seating ? a.seating === "outside" : /outdoor|outside|rooftop|balcony|terrace|smok/i.test(`${a.slug} ${a.name_en}`));

/**
 * One short form: name, phone, email, branch, inside or outside, number of people, date and time,
 * and a note. Availability and hours are the chosen branch's own (get_availability / get_schedule
 * with p_branch); the booking belongs to that branch through its area. Branch and seating are also
 * written as the first lines of the notes, the readable copy staff see. Seats are held only when the
 * form is sent, in the matching area with the most free seats at that time.
 */
export function BookingFlow({ areas, branches }: { areas: Area[]; branches: Branch[] }) {
  const { locale, t } = useI18n();
  const supabase = useMemo(() => createClient(), []);

  const outlets = visibleOutlets();
  const [outletSlug, setOutletSlug] = useState(outlets[0]?.slug ?? "");
  const outlet = outlets.find((o) => o.slug === outletSlug);
  // The database branch for the chosen outlet (same slug). None = that branch takes no online bookings.
  const branchId = branches.find((b) => b.slug === outletSlug)?.id ?? null;
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
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", note: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ reference: string; phone: string } | null>(null);

  // The chosen branch's areas for the chosen seating. If the branch has none of that kind, any of its
  // active areas will do: staff still see the choice in the notes.
  const areaIds = useMemo(() => {
    const active = areas.filter((a) => a.is_active && branchId && a.branch_id === branchId);
    const matching = active.filter((a) => (seating === "outside" ? isOutside(a) : !isOutside(a)));
    return new Set((matching.length ? matching : active).map((a) => a.id));
  }, [areas, seating, branchId]);

  useEffect(() => {
    // Switching branch again before the answer comes back: the older answer is dropped.
    let current = true;
    supabase.rpc("get_schedule", { p_days: DAYS_AHEAD, p_branch: branchId }).then(({ data }) => {
      if (!current) return;
      const map: Record<string, ScheduleDay> = {};
      for (const d of (data ?? []) as ScheduleDay[]) map[d.day] = d;
      setSchedule(map);
      const firstOpen = dates.find((d) => map[d]?.opens);
      if (firstOpen && !map[dates[0]]?.opens) setDate(firstOpen);
    });
    return () => {
      current = false;
    };
  }, [supabase, dates, branchId]);

  // Every availability request is numbered and only the latest may change the screen, so a slow
  // answer for an earlier date or party size never replaces a newer one. The database stays the
  // authority: hold_slot checks capacity again when the form is sent.
  const slotsRequest = useRef(0);
  const fetchSlots = useCallback(async () => {
    const request = ++slotsRequest.current;
    if (!branchId) {
      setSlots([]);
      setLoadError(false);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("get_availability", { p_date: date, p_party_size: party, p_duration_minutes: duration, p_branch: branchId });
    if (request !== slotsRequest.current) return;
    // Say so when times can't be loaded, rather than showing "no free tables".
    setLoadError(Boolean(error));
    setSlots(error ? [] : ((data ?? []) as AvailabilitySlot[]));
    setLoading(false);
  }, [supabase, date, party, duration, branchId]);

  const fetchRef = useRef(fetchSlots);
  fetchRef.current = fetchSlots;

  // The first load asks straight away; later changes wait SLOTS_DEBOUNCE_MS. Any answer still on its
  // way for the old choice is out of date from the moment the choice changes.
  const firstSlots = useRef(true);
  useEffect(() => {
    slotsRequest.current++;
    setLoading(true);
    const wait = firstSlots.current ? 0 : SLOTS_DEBOUNCE_MS;
    firstSlots.current = false;
    const timer = setTimeout(fetchSlots, wait);
    return () => clearTimeout(timer);
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

  // A changed time replaces an earlier "please enter a time" message.
  useEffect(() => {
    setErrors((e) => {
      if (!e.time) return e;
      const { time: _time, ...rest } = e;
      return rest;
    });
  }, [hour, minute, ampm, date]);

  const openDates = dates.filter((d) => Object.keys(schedule).length === 0 || schedule[d]?.opens);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = (k: string) => errors[k];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    // Check the details here first (same limits as the server, which checks again), so no table is
    // held for a form that would be refused, and every problem shows at once.
    const found: Record<string, string> = {};
    const name = form.name.trim();
    const email = form.email.trim();
    if (name.length < 2 || name.length > 80) found.name = t.errors.invalidName;
    if (!normalizePhone(form.phone)) found.phone = t.errors.invalidPhone;
    if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) found.email = t.errors.invalidEmail;
    if (!chosen) found.time = hour === "" ? t.reserve.timeRequired : timeProblem;
    if (Object.keys(found).length > 0 || !chosen) {
      setErrors(found);
      document.getElementById(Object.keys(found)[0])?.focus();
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
      const notes = composeBookingNotes({ branch: outlets.length > 1 ? outlet?.name.en : null, seating, note: form.note });
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
        <div role="radiogroup" aria-label={t.reserve.partySize} onKeyDown={radioKeys} className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {Array.from({ length: SITE.booking.maxOnlineParty }, (_, i) => i + 1).map((count) => (
            <button
              key={count}
              type="button"
              role="radio"
              aria-checked={party === count}
              tabIndex={party === count ? 0 : -1}
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
          {/* Dimmed while the free times for a new date, party size or branch are being checked. */}
          <div aria-busy={loading} className={cn("transition-opacity duration-200 sm:col-span-2", loading && "opacity-50")}>
            {err("time") ? (
              <p role="alert" className="text-sm text-danger">
                {err("time")}
              </p>
            ) : loadError ? (
              <p role="alert" className="text-sm text-danger">
                {t.reserve.timesError}{" "}
                <button
                  type="button"
                  className="font-medium text-primary underline underline-offset-2 evening:text-ink"
                  onClick={() => {
                    setLoading(true);
                    fetchSlots();
                  }}
                >
                  {t.reserve.timesRetry}
                </button>
              </p>
            ) : !loading && times.length === 0 ? (
              <p className="text-sm text-ink-muted">
                {t.reserve.noSlots}{" "}
                <a className="font-medium text-primary evening:text-ink" href={`tel:${SITE.phones[0].tel}`}>
                  {SITE.phones[0].display}
                </a>
              </p>
            ) : hour !== "" && !loading && timeProblem ? (
              <p className="text-sm text-accent-ink">{timeProblem}</p>
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
          {/* Also waits for the free times: sent mid-check, the form would call a free time "not available". */}
          <Button type="submit" size="lg" disabled={pending || loading} className="w-full sm:w-auto">
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
    <div role="radiogroup" aria-label={label} onKeyDown={radioKeys} className="grid gap-3 sm:grid-cols-3">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
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
