import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Fira_Sans, Hind_Siliguri, Kaushan_Script, Montserrat, Noto_Serif_Bengali } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { ambianceScript } from "@/lib/ambiance";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  // No italic: nothing on the site is set in italic, and it was preloaded on every page.
  variable: "--font-cormorant",
  display: "swap",
});
const kaushan = Kaushan_Script({ subsets: ["latin"], weight: "400", variable: "--font-kaushan", display: "swap" });
// Navigation, matching Saalim's reference design: a wide-tracked sans. The home hero's serif and hand
// script (Playfair, Sacramento) are loaded in home-hero.tsx, so only the home page downloads them.
const montserrat = Montserrat({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-montserrat", display: "swap" });
const fira = Fira_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-fira", display: "swap" });
const bnSerif = Noto_Serif_Bengali({
  subsets: ["bengali"],
  weight: ["400", "500", "600"],
  variable: "--font-bn-serif",
  display: "swap",
  preload: false,
});
const bnSans = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-bn-sans",
  display: "swap",
  preload: false,
});
// The taka sign (৳) in prices, cut from the two Bangla fonts above (same glyph; src/app/fonts). They
// come first in the font stacks, so English pages fetch ~1 KB for the sign instead of the whole Bangla
// font (~270 KB on the home page). Bangla text still uses the full fonts.
const takaSerif = localFont({
  src: "./fonts/taka-serif.woff2",
  weight: "100 900",
  variable: "--font-taka-serif",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+09F3" }],
});
const takaSans = localFont({
  src: [
    { path: "./fonts/taka-sans-400.woff2", weight: "400" },
    { path: "./fonts/taka-sans-500.woff2", weight: "500" },
    { path: "./fonts/taka-sans-600.woff2", weight: "600" },
  ],
  variable: "--font-taka-sans",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+09F3" }],
});

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return {
    metadataBase: new URL(SITE.url),
    title: { default: t.meta.title, template: "%s · Pinewood" },
    description: t.meta.description,
    openGraph: {
      type: "website",
      siteName: "Pinewood Cafe + Kitchen",
      title: t.meta.title,
      description: t.meta.description,
      locale: locale === "bn" ? "bn_BD" : "en_US",
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#214e51" },
    { media: "(prefers-color-scheme: dark)", color: "#132f32" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getI18n();

  return (
    <html
      lang={locale}
      data-ambiance="day"
      suppressHydrationWarning
      className={`${cormorant.variable} ${kaushan.variable} ${fira.variable} ${montserrat.variable} ${takaSerif.variable} ${takaSans.variable} ${bnSerif.variable} ${bnSans.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `document.documentElement.classList.add("js");${ambianceScript}` }} />
      </head>
      <body className="min-h-dvh">
        <I18nProvider locale={locale}>{children}</I18nProvider>
        <Toaster
          position="bottom-center"
          toastOptions={{
            className: "!rounded-sm !border-line !bg-surface !text-ink !font-sans",
          }}
        />
      </body>
    </html>
  );
}
