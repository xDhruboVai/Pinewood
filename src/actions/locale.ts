"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/i18n";

export async function setLocale(locale: "en" | "bn") {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale === "bn" ? "bn" : "en", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
