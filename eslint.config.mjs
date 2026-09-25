import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Next.js's recommended rules (React, hooks, accessibility basics, Core Web Vitals) plus TypeScript.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Stated rather than detected: eslint-plugin-react's detection uses an API ESLint 10 removed.
    settings: { react: { version: "19.2" } },
    rules: {
      // `_name` marks a value that is deliberately unused (e.g. a destructured field being dropped).
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
      // React Compiler readiness checks. The site doesn't use the React Compiler, and the patterns they
      // flag are deliberate and tested: reading browser-only state after the first render (to match the
      // server HTML), "latest callback" refs, Date.now() for time-dependent labels. Shown as warnings so
      // they stay visible if the compiler is ever turned on; working code isn't rewritten to silence them.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "backend/dist/**", "next-env.d.ts", "test-results/**", "playwright-report/**", ".venv/**"]),
]);
