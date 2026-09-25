import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
