import type { NextConfig } from "next";

// Content-Security-Policy without nonces (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md):
// nonces would force every page to render per request and drop the public-page caching. Inline scripts
// stay allowed for Next's own bootstrap and the ambiance script in app/layout.tsx; everything else is
// limited to this site, Supabase (browser sign-in, admin reads, realtime) and the Google Maps embed on
// /visit. 'unsafe-eval' is only for `next dev` (React's error overlay). HSTS isn't set here: Vercel
// already sends it on its domains; add it here too once a custom domain is live on HTTPS.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseOrigins = supabaseUrl ? [new URL(supabaseUrl).origin, new URL(supabaseUrl).origin.replace(/^http/, "ws")] : [];
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigins.join(" ")}`.trim(),
  "frame-src https://www.google.com https://maps.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The Playwright tests build into their own folder (playwright.config.ts) so they never replace .next.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // `npm run dev` only answers localhost by default: opened at 127.0.0.1 or the network address
  // (e.g. http://192.168.x.x:3000 on a phone) the page's scripts were blocked, so the booking form
  // never started and nothing could be booked. Dev only; production ignores this.
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.*.*.*"],
  // Frontend preview without Supabase: `PW_PREVIEW=1 npm run dev` swaps the data layer and the
  // Supabase clients for sample data (src/lib/preview), including a signed-in admin. Off by default.
  ...(process.env.PW_PREVIEW === "1"
    ? {
        turbopack: {
          resolveAlias: {
            "@/lib/data": "./src/lib/preview/data.ts",
            "@/lib/supabase/client": "./src/lib/preview/supabase-client.ts",
            "@/lib/supabase/server": "./src/lib/preview/supabase-server.ts",
            "@/lib/supabase/proxy": "./src/lib/preview/supabase-proxy.ts",
          },
        },
      }
    : {}),
  images: {
    // 85 is for the full-screen home hero photos (hero-carousel.tsx); everything else uses 75.
    qualities: [75, 85],
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Signed tokens live in this path; never leak them via Referer or caches.
      {
        source: "/reservation/:token*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
    ];
  },
};

export default nextConfig;
