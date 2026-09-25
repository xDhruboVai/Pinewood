// Staff side, on desktop and mobile: sign in, find a booking, confirm it, cancel a confirmed one,
// edit a menu price (valid, empty, zero), and sign out, including from the small-screen header.
import { expect, test, type Page } from "@playwright/test";
import { STAFF, dhaka, fakeState, resetFake, seedReservation, signIn, watchConsole } from "./support";

test.beforeEach(async () => {
  await resetFake();
});

const rowFor = (page: Page, name: string) => page.getByRole("listitem").filter({ hasText: name });

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/admin/reservations");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Freservations/);
  await page.goto("/admin/menu");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("a wrong password is refused with a message", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(STAFF.email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("reservations: find a booking, confirm it, cancel a confirmed one, sign out", async ({ page }) => {
  const errors = watchConsole(page);
  const { date } = dhaka(0);
  const later = dhaka(0, "23:00").iso; // today in Dhaka, whatever the time now
  await seedReservation({ customer_name: "Rafiq Hasan", starts_at: later, area: "banani-inside", party_size: 4, special_requests: "Seating: Inside (non-smoking)\nBirthday" });
  await seedReservation({ customer_name: "Mitu Akter", starts_at: later, area: "dhanmondi-6-outside", status: "confirmed" });

  await signIn(page);
  await expect(page.getByLabel("Date")).toHaveValue(date);

  const rafiq = rowFor(page, "Rafiq Hasan");
  await expect(rafiq).toBeVisible();
  await expect(rafiq.getByText("Banani · Inside (non-smoking)")).toBeVisible();
  await expect(rafiq.getByText("“Birthday”")).toBeVisible();

  await page.getByRole("textbox", { name: "Search bookings" }).fill("rafiq");
  await expect(rowFor(page, "Mitu Akter")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Search bookings" }).fill("nobody-matches");
  await expect(page.getByText('No bookings match "nobody-matches".')).toBeVisible();
  await page.getByRole("textbox", { name: "Search bookings" }).fill("");

  await rafiq.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Confirmed, guest emailed")).toBeVisible();
  await expect(rafiq.getByRole("button", { name: "Cancel booking" })).toBeVisible();
  expect((await fakeState()).reservations.find((r) => r.customer_name === "Rafiq Hasan")?.status).toBe("confirmed");

  page.once("dialog", (d) => d.accept());
  await rowFor(page, "Mitu Akter").getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByText("Booking cancelled, guest emailed")).toBeVisible();
  expect((await fakeState()).reservations.find((r) => r.customer_name === "Mitu Akter")?.status).toBe("cancelled");

  await page.getByRole("button", { name: "Sign out" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto("/admin/reservations");
  await expect(page).toHaveURL(/\/admin\/login/);
  expect(errors).toEqual([]);
});

test("declining asks first and does nothing if the answer is no", async ({ page }) => {
  await seedReservation({ customer_name: "Sadia Noor", starts_at: dhaka(0, "23:00").iso });
  await signIn(page);
  page.once("dialog", (d) => d.dismiss());
  await rowFor(page, "Sadia Noor").getByRole("button", { name: "Decline" }).click();
  await expect(rowFor(page, "Sadia Noor").getByRole("button", { name: "Confirm" })).toBeVisible();
  expect((await fakeState()).reservations[0].status).toBe("pending");
});

test("menu: change a price, and an empty or zero price is refused and put back", async ({ page }) => {
  await signIn(page, "/admin/menu");
  const price = page.getByLabel("Buffalo Wings price");
  const original = await price.inputValue();

  await price.fill("777");
  await price.press("Enter");
  await expect(page.getByText("Price updated")).toBeVisible();
  expect((await fakeState()).prices.find(([id]) => id === "item-buffalo-wings")?.[1]).toBe(777);

  for (const bad of ["", "0"]) {
    // Enter: the browser's own check stops the form (required, min 1); nothing is sent.
    await price.fill(bad);
    await price.press("Enter");
    expect(await price.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
    // Leaving the field: the site says why and puts the saved price back.
    await price.press("Tab");
    await expect(page.getByText("Buffalo Wings: price not changed. Enter a price above ৳0.").last()).toBeVisible();
    await expect(price).toHaveValue("777");
  }
  expect((await fakeState()).prices.find(([id]) => id === "item-buffalo-wings")?.[1]).toBe(777);

  await page.goto("/menu");
  await expect(page.getByText(/777/).first()).toBeVisible();
  expect(original).not.toBe("777");
});

test("small screens: the admin header fits and signing out works", async ({ page }) => {
  await signIn(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const signOut = page.getByRole("button", { name: "Sign out" }).filter({ visible: true });
  await expect(signOut).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Kitchen", exact: true }).filter({ visible: true })).toBeVisible();
  await signOut.click();
  await expect(page).toHaveURL(/\/admin\/login/);
});
