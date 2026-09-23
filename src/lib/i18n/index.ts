import "server-only";
import { cookies } from "next/headers";
import en from "./en";
import bn from "./bn";
import type { Locale } from "@/lib/types";

export const LOCALE_COOKIE = "pw-locale";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get(LOCALE_COOKIE)?.value === "bn" ? "bn" : "en";
}

export function getDictionary(locale: Locale) {
  return locale === "bn" ? bn : en;
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}

/** Pick the localized column (e.g. name_en / name_bn), falling back to English. */
export function pick(row: object, field: string, locale: Locale): string {
  const r = row as Record<string, unknown>;
  const value = r[`${field}_${locale}`] ?? r[`${field}_en`];
  return typeof value === "string" ? value : "";
}
