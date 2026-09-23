import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Hind_Siliguri, Manrope, Noto_Serif_Bengali } from "next/font/google";
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
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
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
    title: { default: t.meta.title, template: "%s · Pine Wood" },
    description: t.meta.description,
    openGraph: {
      type: "website",
      siteName: "Pine Wood",
      title: t.meta.title,
      description: t.meta.description,
      locale: locale === "bn" ? "bn_BD" : "en_US",
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1512" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getI18n();

  return (
    <html
      lang={locale}
      data-ambiance="day"
      suppressHydrationWarning
      className={`${cormorant.variable} ${manrope.variable} ${bnSerif.variable} ${bnSans.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: ambianceScript }} />
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
