import { expect, type Page } from "@playwright/test";
import { SignJWT } from "jose";
import { FAKE_URL, TEST_TOKEN_SECRET } from "../../playwright.config";

export const STAFF = { email: "manager@pinewood.test", password: "correct-horse-battery" };

export async function fake(path: string, body?: unknown) {
  const res = await fetch(`${FAKE_URL}${path}`, { method: body === undefined && path === "/__state" ? "GET" : "POST", body: body === undefined ? undefined : JSON.stringify(body) });
  return res.json();
}
export const resetFake = () => fake("/__reset", {});
export const failRoutes = (routes: Record<string, number>) => fake("/__fail", routes);
export const fakeState = () => fake("/__state") as Promise<{ reservations: Record<string, unknown>[]; holds: number; hits: Record<string, number>; prices: [string, number][] }>;
export const seedReservation = (fields: Record<string, unknown>) => fake("/__seed", fields) as Promise<{ id: string; reference: string }>;

/** A Dhaka date `days` from today as YYYY-MM-DD and a start instant at HH:MM on it. */
export function dhaka(days: number, time = "12:00") {
  const d = new Date(Date.now() + days * 86_400_000);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return { date, iso: new Date(`${date}T${time}:00+06:00`).toISOString() };
}

/** A guest link signed like the email function signs it (test secret). */
export function guestToken(reservationId: string, version = 1, secret = TEST_TOKEN_SECRET) {
  return new SignJWT({ ver: version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(reservationId)
    .setAudience("pinewood:reservation")
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(secret));
}

/**
 * Collects console errors and uncaught exceptions. The fake backend refuses Realtime websockets on
 * purpose, and deliberate 4xx/5xx responses log "Failed to load resource"; both are ignored.
 */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (/realtime\/v1\/websocket|WebSocket connection|Failed to load resource/.test(text)) return;
    errors.push(text);
  });
  return errors;
}

export async function signIn(page: Page, next = "/admin/reservations") {
  await page.goto(`/admin/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(STAFF.email);
  await page.getByLabel("Password").fill(STAFF.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(next.replace(/[?]/g, "\\?")));
}

/** Opens the site navigation on phones (hamburger) or uses the desktop bar. */
export async function navTo(page: Page, name: string) {
  const burger = page.getByRole("button", { name: "Open menu" });
  if (await burger.isVisible()) {
    await burger.click();
    await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name }).click();
  } else {
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name }).click();
  }
}
