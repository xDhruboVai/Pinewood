import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Two test projects, one runner:
//   unit  - pure logic, server actions (Supabase and Next mocked) and the email Edge Function (Deno
//           globals, Supabase and Resend faked). No network, no database.     npm test
//   db    - the real migrations + seed on a throwaway local Postgres 17 (embedded-postgres). The
//           booking engine, permissions, pre-orders and email queue are tested where they live.
//                                                                                npm run test:db
// End-to-end tests are Playwright (playwright.config.ts).
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: root("./src/") },
      // `server-only` throws outside a React Server Components build; the tests run the modules directly.
      { find: /^server-only$/, replacement: root("./tests/support/empty.ts") },
      // The email Edge Function imports Deno-style npm: specifiers; the same packages are installed here.
      { find: /^npm:@supabase\/supabase-js@2$/, replacement: "@supabase/supabase-js" },
      { find: /^npm:jose@6$/, replacement: "jose" },
    ],
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/db/global-setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
