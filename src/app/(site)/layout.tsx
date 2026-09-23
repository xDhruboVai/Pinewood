import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { AmbianceController } from "@/components/site/ambiance";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AmbianceController />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-sm focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-ink"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="grain">
        {children}
      </main>
      <Footer />
    </>
  );
}
