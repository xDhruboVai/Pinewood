"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Clock, Minus, Plus, Timer, Users } from "lucide-react";
import { holdSlot, joinWaitlist, releaseHold, submitReservation } from "@/actions/reservation";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/client";
import { useI18n, pickClient } from "@/lib/i18n/client";
import { dhakaDate, durationLabel, formatDate, formatDateLong, formatNumber, formatTime } from "@/lib/format";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { Area, AvailabilitySlot, ScheduleDay } from "@/lib/types";

type Step = "slot" | "details" | "done";
type Mode = "book" | "waitlist";

interface Selection {
  slot: AvailabilitySlot;
  mode: Mode;
  holdId?: string;
  expiresAt?: string;
}

const DAYS_AHEAD = 31;

export function BookingFlow({ areas, initialArea }: { areas: Area[]; initialArea?: string }) {
  const { locale, t } = useI18n();
  const supabase = useMemo(() => createClient(), []);

  const activeAreas = areas.filter((a) => a.is_active);
  const [areaId, setAreaId] = useState<string>(
    activeAreas.find((a) => a.slug === initialArea)?.id ?? activeAreas.find((a) => a.slug === "timber-hall")?.id ?? activeAreas[0]?.id ?? "",
  );
  const dates = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => dhakaDate(i)), []);
  const [date, setDate] = useState(dates[0]);
  const [party, setParty] = useState(2);
  const [largeParty, setLargeParty] = useState(false);
  const [duration, setDuration] = useState<number>(SITE.booking.defaultDuration);
  const [schedule, setSchedule] = useState<Record<string, ScheduleDay>>({});
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("slot");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [holding, startHold] = useTransition();
  const [result, setResult] = useState<{ reference?: string; phone?: string; mode: Mode } | null>(null);

  // Opening schedule (to disable closed days)
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
    const { data, error } = await supabase.rpc("get_availability", {
      p_date: date,
      p_party_size: party,
      p_duration_minutes: duration,
    });
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
    const poll = setInterval(() => fetchRef.current(), 60_000);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const areaSlots = slots.filter((s) => s.area_id === areaId);
  const availableCount = (id: string) => slots.filter((s) => s.area_id === id && s.available).length;
  const area = activeAreas.find((a) => a.id === areaId);
  const day = schedule[date];
  const dayClosed = Object.keys(schedule).length > 0 && !day?.opens;

  const choose = (slot: AvailabilitySlot) => {
    if (slot.available) {
      startHold(async () => {
        const res = await holdSlot({ areaId: slot.area_id, start: slot.slot_start, duration, partySize: party });
        if (!res.ok) {
          toast.error(t.errors[res.error] ?? t.errors.generic);
          fetchSlots();
          return;
        }
        setSelection({ slot, mode: "book", holdId: res.data.holdId, expiresAt: res.data.expiresAt });
        setStep("details");
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    } else if (slot.waitlist_eligible) {
      setSelection({ slot, mode: "waitlist" });
      setStep("details");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const backToSlots = () => {
    if (selection?.holdId) void releaseHold(selection.holdId);
    setSelection(null);
    setStep("slot");
    fetchSlots();
  };

  const reset = () => {
    setSelection(null);
    setResult(null);
    setStep("slot");
    fetchSlots();
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_340px] lg:gap-14">
      <div>
        <Stepper step={step} />

        {step === "slot" ? (
          <div className="mt-10 space-y-10">
            {/* Date */}
            <section aria-labelledby="date-label">
              <h2 id="date-label" className="eyebrow">
                {t.reserve.date}
              </h2>
              <div className="-mx-4 mt-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
                {dates.map((d) => {
                  const closed = Object.keys(schedule).length > 0 && !schedule[d]?.opens;
                  const selected = d === date;
                  const iso = `${d}T12:00:00+06:00`;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={closed}
                      onClick={() => setDate(d)}
                      aria-pressed={selected}
                      className={cn(
                        "flex w-16 shrink-0 snap-start flex-col items-center rounded-sm border py-2.5 transition-colors",
                        selected ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink hover:border-ink/40",
                        closed && "cursor-not-allowed opacity-40",
                      )}
                    >
                      <span className="text-[0.65rem] font-semibold tracking-wider uppercase opacity-75">
                        {formatDate(iso, locale, { weekday: "short", day: undefined, month: undefined })}
                      </span>
                      <span className="font-display text-2xl leading-tight">{formatDate(iso, locale, { weekday: undefined, day: "numeric", month: undefined })}</span>
                      <span className="text-[0.65rem] opacity-75">{formatDate(iso, locale, { weekday: undefined, day: undefined, month: "short" })}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Party + duration */}
            <section className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="eyebrow">{t.reserve.partySize}</p>
                <div className="mt-4 flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="−"
                    disabled={largeParty || party <= 1}
                    onClick={() => setParty((p) => Math.max(1, p - 1))}
                  >
                    <Minus />
                  </Button>
                  <output className="w-16 text-center font-display text-4xl text-ink" aria-live="polite">
                    {formatNumber(party, locale)}
                    {largeParty ? "+" : ""}
                  </output>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="+"
                    disabled={largeParty || party >= SITE.booking.maxOnlineParty}
                    onClick={() => setParty((p) => Math.min(SITE.booking.maxOnlineParty, p + 1))}
                  >
                    <Plus />
                  </Button>
                </div>
                <label className="mt-4 flex items-start gap-2.5 text-sm text-ink">
                  <Checkbox
                    checked={largeParty}
                    onChange={(e) => {
                      setLargeParty(e.target.checked);
                      if (e.target.checked) setParty(SITE.booking.maxOnlineParty);
                    }}
                  />
                  <span>
                    {t.reserve.largeParty}
                    <span className="mt-0.5 block text-xs text-ink-muted">{t.reserve.largePartyHint}</span>
                  </span>
                </label>
              </div>
              <div>
                <label htmlFor="duration" className="eyebrow block">
                  {t.reserve.duration}
                </label>
                <div className="mt-4">
                  <Select id="duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                    {SITE.booking.durations.map((m) => (
                      <option key={m} value={m}>
                        {durationLabel(m, locale)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </section>

            {/* Area */}
            <section aria-labelledby="area-label">
              <h2 id="area-label" className="eyebrow">
                {t.reserve.area}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {activeAreas.map((a) => {
                  const count = availableCount(a.id);
                  const selected = a.id === areaId;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAreaId(a.id)}
                      aria-pressed={selected}
                      className={cn(
                        "rounded-sm border p-4 text-left transition-colors",
                        selected ? "border-primary bg-surface ring-1 ring-primary" : "border-line bg-surface hover:border-ink/40",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-display text-xl text-ink">{pickClient(a, "name", locale)}</span>
                        {selected ? <Check className="size-4 text-primary" /> : null}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-ink-muted">{pickClient(a, "description", locale)}</span>
                      {!loading ? (
                        <span className={cn("mt-2 block text-xs font-semibold", count > 0 ? "text-forest-500 evening:text-forest-300" : "text-ink-muted")}>
                          {count > 0 ? t.reserve.slotsOpen(count) : t.reserve.full}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Times */}
            <section aria-labelledby="time-label" aria-busy={loading}>
              <div className="flex items-center justify-between">
                <h2 id="time-label" className="eyebrow">
                  {area ? pickClient(area, "name", locale) : ""} · {formatDateLong(`${date}T12:00:00+06:00`, locale)}
                </h2>
                <span className="inline-flex items-center gap-2 text-xs text-ink-muted">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest-400 opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-forest-400" />
                  </span>
                  {t.reserve.live}
                </span>
              </div>

              {dayClosed ? (
                <p className="mt-6 rounded-sm border border-line bg-surface p-6 text-sm text-ink-muted">
                  {t.reserve.closedDay} {day?.label ? `(${day.label})` : ""}
                </p>
              ) : loading ? (
                <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-sm bg-surface-2" />
                  ))}
                </div>
              ) : areaSlots.length === 0 ? (
                <p className="mt-6 rounded-sm border border-line bg-surface p-6 text-sm text-ink-muted">
                  {t.reserve.noSlots}{" "}
                  <a className="underline" href={`tel:${SITE.phones[0].tel}`}>
                    {SITE.phones[0].display}
                  </a>
                </p>
              ) : (
                <>
                  <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                    {areaSlots.map((s) => {
                      const low = s.available && s.remaining - party < 6;
                      return (
                        <button
                          key={s.slot_start}
                          type="button"
                          disabled={holding || (!s.available && !s.waitlist_eligible)}
                          onClick={() => choose(s)}
                          className={cn(
                            "flex h-16 flex-col items-center justify-center rounded-sm border text-sm transition-all",
                            s.available && "border-line bg-surface text-ink hover:-translate-y-0.5 hover:border-primary hover:shadow-sm",
                            !s.available && s.waitlist_eligible && "border-dashed border-accent/70 bg-accent/5 text-ink hover:bg-accent/10",
                            !s.available && !s.waitlist_eligible && "cursor-not-allowed border-line/60 text-ink-muted/60 line-through",
                          )}
                        >
                          <span className="font-semibold">{formatTime(s.slot_start, locale)}</span>
                          <span className="mt-0.5 text-[0.65rem]">
                            {s.available
                              ? low
                                ? t.reserve.seatsLeft(s.remaining)
                                : " "
                              : s.waitlist_eligible
                                ? t.reserve.waitlist
                                : t.reserve.full}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {areaSlots.some((s) => !s.available && s.waitlist_eligible) ? (
                    <p className="mt-4 text-xs leading-relaxed text-ink-muted">{t.reserve.waitlistHint}</p>
                  ) : null}
                </>
              )}
            </section>
          </div>
        ) : null}

        {step === "details" && selection ? (
          <DetailsForm
            selection={selection}
            duration={duration}
            party={party}
            largeParty={largeParty}
            onBack={backToSlots}
            onDone={(r) => {
              setResult(r);
              setStep("done");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        ) : null}

        {step === "done" && result ? (
          <div className="mt-10 rounded-sm border border-line bg-surface p-8 sm:p-10">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary text-primary-ink">
              <Check className="size-6" />
            </span>
            <h2 className="display mt-6 text-4xl text-ink">
              {result.mode === "book" ? t.reserve.doneTitle : t.reserve.doneWaitlistTitle}
            </h2>
            <p className="mt-4 max-w-xl leading-relaxed text-ink-muted">
              {result.mode === "book" ? t.reserve.doneBody(result.phone ?? "") : t.reserve.doneWaitlistBody}
            </p>
            {result.reference ? (
              <p className="mt-6 text-sm text-ink-muted">
                {t.reserve.reference}: <span className="font-mono text-base font-semibold tracking-wider text-ink">{result.reference}</span>
              </p>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={reset}>{t.reserve.another}</Button>
              <Button asChild variant="outline">
                <Link href="/menu">{t.nav.menu}</Link>
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-sm border border-line bg-surface p-6">
          <p className="eyebrow">{t.reserve.summary}</p>
          <dl className="mt-5 space-y-3 text-sm">
            <SummaryRow icon={<Clock className="size-4" />} label={t.reserve.date}>
              {formatDateLong(selection?.slot.slot_start ?? `${date}T12:00:00+06:00`, locale)}
              {selection ? (
                <span className="block text-ink-muted">
                  {formatTime(selection.slot.slot_start, locale)} – {formatTime(selection.slot.slot_end, locale)}
                </span>
              ) : null}
            </SummaryRow>
            <SummaryRow icon={<Users className="size-4" />} label={t.reserve.partySize}>
              {formatNumber(party, locale)}
              {largeParty ? "+" : ""} · {durationLabel(duration, locale)}
            </SummaryRow>
            <SummaryRow icon={<Check className="size-4" />} label={t.reserve.area}>
              {area ? pickClient(area, "name", locale) : "—"}
            </SummaryRow>
          </dl>
          {step === "details" && selection?.mode === "book" && selection.expiresAt ? (
            <HoldTimer expiresAt={selection.expiresAt} />
          ) : null}
        </div>
        <p className="mt-4 px-1 text-xs leading-relaxed text-ink-muted">
          {t.visit.phones}:{" "}
          {SITE.phones.map((p, i) => (
            <span key={p.tel}>
              {i > 0 ? " · " : ""}
              <a href={`tel:${p.tel}`} className="underline-offset-2 hover:underline">
                {p.display}
              </a>
            </span>
          ))}
        </p>
      </aside>
    </div>
  );
}

function SummaryRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="mt-0.5 text-accent-ink" aria-label={label}>
        {icon}
      </dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const { t } = useI18n();
  const steps: [Step, string][] = [
    ["slot", t.reserve.stepSlot],
    ["details", t.reserve.stepDetails],
    ["done", t.reserve.stepDone],
  ];
  const index = steps.findIndex(([s]) => s === step);
  return (
    <ol className="flex items-center gap-3 text-xs font-semibold tracking-wide">
      {steps.map(([s, label], i) => (
        <li key={s} className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full border text-[0.7rem]",
              i < index && "border-primary bg-primary text-primary-ink",
              i === index && "border-primary text-primary",
              i > index && "border-line text-ink-muted",
            )}
          >
            {i < index ? <Check className="size-3" /> : i + 1}
          </span>
          <span className={cn(i === index ? "text-ink" : "text-ink-muted", "hidden sm:inline")}>{label}</span>
          {i < steps.length - 1 ? <span className="h-px w-6 bg-line sm:w-10" /> : null}
        </li>
      ))}
    </ol>
  );
}

function HoldTimer({ expiresAt }: { expiresAt: string }) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, new Date(expiresAt).getTime() - now);
  const mm = String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");

  return (
    <div className={cn("mt-6 rounded-sm border p-4 text-sm", left > 0 ? "border-accent/50 bg-accent/5" : "border-line bg-surface-2")}>
      {left > 0 ? (
        <p className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-ink">
            <Timer className="size-4 text-accent-ink" />
            {t.reserve.holding}
          </span>
          <span className="font-mono text-base font-semibold text-ink tabular-nums" aria-label={t.reserve.holdExpires}>
            {mm}:{ss}
          </span>
        </p>
      ) : (
        <p className="text-ink-muted">{t.reserve.holdExpired}</p>
      )}
    </div>
  );
}

function DetailsForm({
  selection,
  duration,
  party,
  largeParty,
  onBack,
  onDone,
}: {
  selection: Selection;
  duration: number;
  party: number;
  largeParty: boolean;
  onBack: () => void;
  onDone: (r: { reference?: string; phone?: string; mode: Mode }) => void;
}) {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "", phone: "", email: "", requests: "", consent: false, website: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const common = { ...form, largeParty, locale };
      const res =
        selection.mode === "book"
          ? await submitReservation({ ...common, holdId: selection.holdId })
          : await joinWaitlist({
              ...common,
              areaId: selection.slot.area_id,
              start: selection.slot.slot_start,
              duration,
              partySize: party,
            });

      if (!res.ok) {
        if ("fields" in res && res.fields) {
          setErrors(Object.fromEntries(Object.entries(res.fields).map(([k, v]) => [k, t.errors[v] ?? t.errors.generic])));
        }
        toast.error(t.errors[res.error] ?? t.errors.generic);
        return;
      }
      onDone({
        mode: selection.mode,
        reference: "reference" in res.data ? res.data.reference : undefined,
        phone: "phone" in res.data ? res.data.phone : undefined,
      });
    });
  };

  const err = (k: string) => errors[k];

  return (
    <form onSubmit={submit} noValidate className="mt-10 space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" />
        {t.reserve.changeSlot}
      </button>

      {selection.mode === "waitlist" ? (
        <p className="rounded-sm border border-dashed border-accent/70 bg-accent/5 p-4 text-sm leading-relaxed text-ink">{t.reserve.waitlistHint}</p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t.reserve.name} htmlFor="name" error={err("name")} className="sm:col-span-2">
          <Input id="name" autoComplete="name" required value={form.name} onChange={set("name")} aria-invalid={!!err("name")} />
        </Field>
        <Field label={t.reserve.phone} htmlFor="phone" hint={t.reserve.phoneHint} error={err("phone")}>
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
          />
        </Field>
        <Field label={t.reserve.email} htmlFor="email" hint={t.reserve.emailHint} error={err("email")}>
          <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} aria-invalid={!!err("email")} />
        </Field>
        <Field label={t.reserve.requests} htmlFor="requests" className="sm:col-span-2">
          <Textarea id="requests" maxLength={500} placeholder={t.reserve.requestsPlaceholder} value={form.requests} onChange={set("requests")} />
        </Field>
      </div>

      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm leading-relaxed text-ink">
          <Checkbox checked={form.consent} onChange={set("consent")} aria-invalid={!!err("consent")} />
          <span>
            {t.reserve.consent}{" "}
            <Link href="/privacy" target="_blank" className="underline underline-offset-2">
              {t.reserve.privacyLink}
            </Link>
          </span>
        </label>
        {err("consent") ? <p className="mt-1.5 text-xs text-danger">{err("consent")}</p> : null}
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? t.reserve.submitting : selection.mode === "book" ? t.reserve.submit : t.reserve.submitWaitlist}
      </Button>
    </form>
  );
}
