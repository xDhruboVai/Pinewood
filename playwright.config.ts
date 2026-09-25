import { defineConfig, devices } from "@playwright/test";

// End-to-end tests: a production build of the site (in .next/e2e) talking to the fake Supabase in
// tests/e2e/fake-supabase.mjs. Nothing here reaches a real database, Resend or Vercel.
//
//   npm run test:e2e                       (uses Playwright's Chromium: npx playwright install chromium)
//   PW_CHANNEL=msedge npm run test:e2e     (or the installed Microsoft Edge / chrome instead)
const FAKE_PORT = 54329;
const SITE_PORT = 3210;
export const FAKE_URL = `http://127.0.0.1:${FAKE_PORT}`;
// Test-only values. Not secrets: they only work against the fake backend above.
export const TEST_TOKEN_SECRET = "e2e-reservation-token-secret-not-a-real-secret";

const env = {
  NEXT_DIST_DIR: ".next/e2e",
  NEXT_PUBLIC_SUPABASE_URL: FAKE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "e2e-publishable-key",
  SUPABASE_SECRET_KEY: "e2e-secret-key",
  NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${SITE_PORT}`,
  RESERVATION_TOKEN_SECRET: TEST_TOKEN_SECRET,
  NEXT_TELEMETRY_DISABLED: "1",
  FAKE_SUPABASE_PORT: String(FAKE_PORT),
};
const channel = process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  // One shared fake backend: run the files one after another.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${SITE_PORT}`, trace: "retain-on-failure", locale: "en-GB", timezoneId: "Asia/Dhaka" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 }, channel } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel } },
  ],
  webServer: [
    { command: "node tests/e2e/fake-supabase.mjs", url: `${FAKE_URL}/__state`, env, reuseExistingServer: false, stdout: "ignore" },
    {
      command: `npm run build && npm run start -- -p ${SITE_PORT}`,
      url: `http://127.0.0.1:${SITE_PORT}`,
      env,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      stdout: "ignore",
    },
  ],
});
