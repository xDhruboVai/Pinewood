import { SITE } from "@/lib/site";
import type { Locale } from "@/lib/types";

const tz = SITE.timeZone;
const intlLocale = (locale: Locale) => (locale === "bn" ? "bn-BD" : "en-GB");

export function formatPrice(amount: number, locale: Locale = "en") {
  const n = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }).format(Math.round(amount));
  return `৳${n}`;
}

export function formatNumber(n: number, locale: Locale = "en") {
  return new Intl.NumberFormat(intlLocale(locale)).format(n);
}

export function formatTime(iso: string | Date, locale: Locale = "en") {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatDate(iso: string | Date, locale: Locale = "en", opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    ...opts,
  }).format(new Date(iso));
}

export function formatDateLong(iso: string | Date, locale: Locale = "en") {
  return formatDate(iso, locale, { weekday: "long", month: "long", year: "numeric" });
}

/** YYYY-MM-DD for "today" (or today + offset days) in Dhaka. */
export function dhakaDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Convert a Dhaka wall-clock date + "HH:MM" into an ISO instant (Dhaka is UTC+6, no DST). */
export function dhakaToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00+06:00`).toISOString();
}

export function isoToDhakaDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function isoToDhakaTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

/** Normalises Bangladeshi numbers to E.164; passes through valid international numbers. */
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  const bd = cleaned.match(/^(?:\+?88)?(01[3-9]\d{8})$/);
  if (bd) return `+88${bd[1]}`;
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) return cleaned;
  return null;
}
