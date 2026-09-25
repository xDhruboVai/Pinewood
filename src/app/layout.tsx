import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Fira_Sans, Hind_Siliguri, Kaushan_Script, Montserrat, Noto_Serif_Bengali, Playfair_Display, Sacramento } from "next/font/google";
import { Toaster } from "sonner";
import { ambianceScript } from "@/components/site/ambiance";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});
const kaushan = Kaushan_Script({ subsets: ["latin"], weight: "400", variable: "--font-kaushan", display: "swap" });
// Home hero and navigation only, matching Saalim's reference design: a heavy high-contrast serif for
// the dish name and price, a thin handwritten script for the accent lines, and a wide-tracked sans.
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const sacramento = Sacramento({ subsets: ["latin"], weight: "400", variable: "--font-sacramento", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-montserrat", display: "swap" });
const fira = Fira_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-fira", display: "swap" });
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
      className={`${cormorant.variable} ${kaushan.variable} ${fira.variable} ${playfair.variable} ${sacramento.variable} ${montserrat.variable} ${bnSerif.variable} ${bnSans.variable}`}
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
