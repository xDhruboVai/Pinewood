"use client";

import { createContext, useContext } from "react";
import en, { type Dictionary } from "./en";
import bn from "./bn";
import type { Locale } from "@/lib/types";

const I18nContext = createContext<{ locale: Locale; t: Dictionary }>({ locale: "en", t: en });

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, t: locale === "bn" ? bn : en }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function pickClient(row: object, field: string, locale: Locale): string {
  const r = row as Record<string, unknown>;
  const value = r[`${field}_${locale}`] ?? r[`${field}_en`];
  return typeof value === "string" ? value : "";
}
