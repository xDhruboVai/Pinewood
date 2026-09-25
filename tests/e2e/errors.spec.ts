// Failure states: every one should end in a clear, branded message, never a raw database error, a
// blank page or a bare 500. Failures are injected into the fake backend (tests/e2e/fake-supabase.mjs).
import { expect, test } from "@playwright/test";
import { dhaka, failRoutes, fake, fakeState, guestToken, resetFake, seedReservation, signIn } from "./support";

const RAW = /secret_table|relation|XX000|internal error/i;

test.beforeEach(async () => {
  await resetFake();
});

test.describe("guest booking links", () => {
  test("a valid link shows the booking; the guest can ask to cancel", async ({ page }) => {
    const r = await seedReservation({ customer_name: "Nadia Rahman", starts_at: dhaka(3, "19:30").iso, status: "confirmed", token_version: 2 });
    await page.goto(`/reservation/${await guestToken(r.id, 2)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nadia Rahman");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Request cancellation" }).click();
    await expect(page.getByText("Cancellation requested. We'll be in touch shortly.").first()).toBeVisible();
    expect((await fakeState()).reservations[0].cancel_requested_at).toBeTruthy();
  });

  // Not covered: a URL whose percent-encoding is itself broken (/reservation/%E0%A4%A) gets Next.js's
  // plain "Internal Server Error" from the router, before the app or its error pages run.
  test("a forged, outdated, garbled or badly encoded link shows the expired-link page", async ({ page }) => {
    const r = await seedReservation({ customer_name: "Nadia Rahman", starts_at: dhaka(3, "19:30").iso, token_version: 2 });
    const links = [
      await guestToken(r.id, 1), // older link: token_version moved on
      await guestToken(r.id, 2, "someone-elses-secret-someone-elses"), // forged
      "not-a-token",
      "a".repeat(3000),
      "abc%25E0%25A4", // arrives as "abc%E0%A4": the page's own decode used to throw (500)
    ];
    for (const link of links) {
      const res = await page.goto(`/reservation/${link}`);
      expect(res?.status(), link.slice(0, 20)).toBeLessThan(500);
      await expect(page.getByRole("heading", { level: 1 }), link.slice(0, 20)).toHaveText("This link has expired");
      await expect(page.getByText("Nadia Rahman")).toHaveCount(0);
    }
  });
});

test("database down while the menu has to be read: branded error page, then recovery", async ({ page }) => {
  // Expire the cached menu through the admin screen, then make the database fail.
  await signIn(page, "/admin/menu");
  const price = page.getByLabel("Buffalo Wings price");
  await price.fill(String(Number(await price.inputValue()) + 1));
  await price.press("Enter");
  await expect(page.getByText("Price updated")).toBeVisible();
  await failRoutes({ "GET /rest/v1/menu_categories": 500 });

  const res = await page.goto("/menu");
  await expect(page.getByRole("heading", { name: "Something went wrong." })).toBeVisible();
  expect(await page.content()).not.toMatch(RAW);
  expect(res?.status()).toBe(500); // the right status for crawlers, with the branded page on it

  await failRoutes({});
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Our Menu");
});

test("free times can't be loaded: a message and a retry, then times", async ({ page }) => {
  await failRoutes({ "POST /rest/v1/rpc/get_availability": 500 });
  await page.goto("/reserve");
  await expect(page.getByText("We couldn't load the free times.")).toBeVisible();
  expect(await page.content()).not.toMatch(RAW);
  await failRoutes({});
  await page.getByRole("button", { name: /try again/i }).click();
  await expect(page.getByText("We couldn't load the free times.")).toHaveCount(0);
});

test("holding the table fails on the server: a plain message, no booking", async ({ page }) => {
  await failRoutes({ "POST /rest/v1/rpc/hold_slot": 500 });
  await page.goto("/reserve");
  await page.getByLabel("Name").fill("Nadia Rahman");
  await page.getByLabel("Phone").fill("01712345678");
  await page.getByLabel("Email").fill("nadia@example.test");
  await page.locator("#date").click();
  await page.getByRole("dialog").getByRole("button").filter({ hasText: /^\d+$/ }).and(page.locator(":not([disabled])")).nth(1).click();
  await page.getByRole("textbox", { name: "Hour" }).click();
  await page.getByRole("textbox", { name: "Hour" }).pressSequentially("7");
  await page.getByRole("textbox", { name: "Minute" }).click();
  await page.getByRole("textbox", { name: "Minute" }).pressSequentially("30");
  await page.keyboard.press("p");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Request reservation" }).click();
  await expect(page.getByText("Something went wrong. Please try again or call us.")).toBeVisible();
  expect(await page.content()).not.toMatch(RAW);
  expect((await fakeState()).reservations).toHaveLength(0);
});

test.describe("staff screens", () => {
  test("the day's bookings can't be loaded: a message and Try again", async ({ page }) => {
    await seedReservation({ customer_name: "Rafiq Hasan", starts_at: dhaka(0, "23:00").iso });
    await signIn(page);
    await failRoutes({ "POST /rest/v1/rpc/admin_list_reservations": 500 });
    await page.getByRole("button", { name: "Next day" }).click();
    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(page.getByText("The bookings for this day couldn't be loaded.")).toBeVisible();
    await expect(page.getByText("No bookings")).toHaveCount(0);
    expect(await page.content()).not.toMatch(RAW);
    await failRoutes({});
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Rafiq Hasan")).toBeVisible();
  });

  test("a status change the database refuses shows a plain message, not the database error", async ({ page }) => {
    await seedReservation({ customer_name: "Rafiq Hasan", starts_at: dhaka(0, "23:00").iso });
    await signIn(page);
    await failRoutes({ "POST /rest/v1/rpc/admin_set_status": 500 });
    await page.getByRole("listitem").filter({ hasText: "Rafiq Hasan" }).getByRole("button", { name: "Confirm" }).click();
    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible();
    await expect(page.locator("[data-sonner-toast]").first()).not.toContainText(RAW);
    expect((await fakeState()).reservations[0].status).toBe("pending");
  });

  test("an expired session: the action says to sign in again and changes nothing", async ({ page }) => {
    await seedReservation({ customer_name: "Rafiq Hasan", starts_at: dhaka(0, "23:00").iso });
    await signIn(page);
    await fake("/__revoke", {});
    await page.getByRole("listitem").filter({ hasText: "Rafiq Hasan" }).getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Your session has ended. Please sign in again.")).toBeVisible();
    expect((await fakeState()).reservations[0].status).toBe("pending");
    await page.goto("/admin/reservations");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

test("an unknown page is a branded 404", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
