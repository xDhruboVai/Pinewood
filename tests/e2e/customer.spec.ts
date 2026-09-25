// A guest's whole visit, on the desktop and mobile projects: pages, then a booking from start to
// reference number, plus the form refusing bad details and a bad time before anything is held.
import { expect, test, type Page } from "@playwright/test";
import { fakeState, navTo, resetFake, watchConsole } from "./support";

test.beforeEach(async () => {
  await resetFake();
});

async function pickTomorrow(page: Page) {
  await page.locator("#date").click();
  const days = page.getByRole("dialog").getByRole("button").filter({ hasText: /^\d+$/ }).and(page.locator(":not([disabled])"));
  await days.nth(1).click(); // the first enabled day is today; take the next one
}

async function typeTime(page: Page, hour: string, minute: string, ampm: "a" | "p") {
  const hourBox = page.getByRole("textbox", { name: "Hour" });
  const minuteBox = page.getByRole("textbox", { name: "Minute" });
  await hourBox.click(); // opens the time wheel and selects the pre-filled hour
  await hourBox.pressSequentially(hour);
  await minuteBox.click();
  await minuteBox.pressSequentially(minute);
  await page.keyboard.press(ampm);
  await page.keyboard.press("Enter"); // closes the time wheel, does not send the form
}

test("home -> menu -> visit -> about -> reserve -> booking reference", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pinewood Cafe + Kitchen");

  await navTo(page, "Menu");
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Our Menu");
  await expect(page.getByText("Buffalo Wings").first()).toBeVisible();

  await navTo(page, "Visit us");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find Us");
  await expect(page.getByText("Banani").first()).toBeVisible();

  await navTo(page, "About us");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About Pinewood");

  await page.getByRole("link", { name: "Reserve a table" }).first().click();
  await expect(page).toHaveURL(/\/reserve$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reserve a table");

  await page.getByLabel("Name").fill("Nadia Rahman");
  await page.getByLabel("Phone").fill("017 1234 5678");
  await page.getByLabel("Email").fill("nadia@example.test");
  await page.getByRole("radio", { name: /Banani/ }).click();
  await page.getByRole("radio", { name: /Outside/ }).click();
  await page.getByRole("radiogroup", { name: "Number of people" }).getByRole("radio", { name: "3", exact: true }).click();
  await pickTomorrow(page);
  await typeTime(page, "7", "30", "p");
  await expect(page.getByText(/Tables free from/)).toBeVisible();
  await page.getByLabel(/note/i).fill("Window table if possible");
  await page.getByRole("button", { name: "Request reservation" }).click();

  await expect(page.getByRole("heading", { name: "Request received" })).toBeVisible();
  const reference = await page.getByText(/^PW-/).textContent();
  expect(reference).toMatch(/^PW-[A-Z0-9]{6}$/);

  const { reservations } = await fakeState();
  expect(reservations).toHaveLength(1);
  expect(reservations[0]).toMatchObject({
    reference,
    customer_name: "Nadia Rahman",
    phone: "+8801712345678",
    email: "nadia@example.test",
    party_size: 3,
    status: "pending",
    special_requests: "Branch: Banani\nSeating: Outside (smoking)\nWindow table if possible",
  });
  expect(new Date(String(reservations[0].starts_at)).toISOString()).toMatch(/T13:30:00/); // 7:30 pm in Dhaka
  expect(errors).toEqual([]);
});

test("invalid details: every problem shown at once, focus on the first, nothing held", async ({ page }) => {
  await page.goto("/reserve");
  await page.getByLabel("Name").fill("N");
  await page.getByLabel("Phone").fill("12345");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Request reservation" }).click();

  await expect(page.getByText("Please enter your name (2–80 characters).")).toBeVisible();
  await expect(page.getByText("Please enter a valid phone number, e.g. 01XXXXXXXXX.")).toBeVisible();
  await expect(page.getByText("Please enter a valid email address.")).toBeVisible();
  await expect(page.getByText("Please enter a time.")).toBeVisible();
  await expect(page.getByLabel("Name")).toBeFocused();
  expect((await fakeState()).hits["POST /rest/v1/rpc/hold_slot"]).toBeUndefined();
});

test("invalid time: a quarter past is refused before anything is held, and stays as typed", async ({ page }) => {
  await page.goto("/reserve");
  await page.getByLabel("Name").fill("Nadia Rahman");
  await page.getByLabel("Phone").fill("01712345678");
  await page.getByLabel("Email").fill("nadia@example.test");
  await pickTomorrow(page);
  await typeTime(page, "7", "15", "p");
  await expect(page.getByText("Please choose a time on the hour or half hour, like 7:00 or 7:30.")).toBeVisible();
  await page.getByRole("button", { name: "Request reservation" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "on the hour or half hour" })).toBeVisible();
  // Regression (found by this test): putting focus back on the time reopens the wheel, and opening
  // it used to reset a typed minute it doesn't list to 00, turning 7:15 into 7:00 and clearing the message.
  await page.waitForTimeout(600);
  await expect(page.getByRole("textbox", { name: "Minute" })).toHaveValue("15");
  await expect(page.getByRole("alert").filter({ hasText: "on the hour or half hour" })).toBeVisible();
  expect((await fakeState()).hits["POST /rest/v1/rpc/hold_slot"]).toBeUndefined();
  await expect(page.getByRole("heading", { name: "Request received" })).toHaveCount(0);
});

test("the time wheel still picks a time by tapping and by scrolling", async ({ page }) => {
  await page.goto("/reserve");
  await pickTomorrow(page);
  await page.getByRole("textbox", { name: "Hour" }).click();
  const wheel = page.getByRole("dialog", { name: "Hour" });
  await wheel.getByRole("listbox", { name: "Hour" }).getByRole("option", { name: "8", exact: true }).click();
  await wheel.getByRole("listbox", { name: "AM / PM" }).getByRole("option", { name: "pm" }).click();
  const minutes = wheel.getByRole("listbox", { name: "Minute" });
  await minutes.hover();
  await page.mouse.wheel(0, 40); // one row down: 00 -> 30
  await expect(page.getByRole("textbox", { name: "Minute" })).toHaveValue("30");
  await wheel.getByRole("button", { name: "OK" }).click();
  await expect(page.getByText(/· 8:30 pm ·/)).toBeVisible();
});

test("the pages fit the screen with no sideways scrolling", async ({ page }) => {
  for (const path of ["/", "/menu", "/visit", "/about", "/reserve", "/privacy"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
