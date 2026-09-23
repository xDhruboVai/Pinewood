import Link from "next/link";
import { Phone } from "lucide-react";
import { Logo } from "./logo";
import { getI18n } from "@/lib/i18n";
import { SITE } from "@/lib/site";

export async function Footer() {
  const { locale, t } = await getI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="grain border-t border-line bg-surface-2">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-10">
        <div>
          <Logo subline="Café · Dhanmondi" />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink-muted">{t.footer.tagline}</p>
          <p className="mt-2 text-sm text-ink-muted">{t.footer.hours}</p>
        </div>
        <div>
          <p className="eyebrow">{t.visit.address}</p>
          <address className="mt-4 text-sm leading-relaxed text-ink not-italic">
            {SITE.address[locale]}
            <br />
            <span className="text-ink-muted">{SITE.address.landmark[locale]}</span>
          </address>
        </div>
        <div>
          <p className="eyebrow">{t.visit.phones}</p>
          <ul className="mt-4 space-y-2">
            {SITE.phones.map((p) => (
              <li key={p.tel}>
                <a href={`tel:${p.tel}`} className="inline-flex items-center gap-2 text-sm text-ink hover:text-accent-ink">
                  <Phone className="size-3.5" aria-hidden />
                  {p.display}
                </a>
              </li>
            ))}
          </ul>
          <a href={SITE.social.facebook} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
            Facebook
          </a>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ink-muted sm:px-6 lg:px-10">
          <p>
            © {year} Pine Wood. {t.footer.rights}
          </p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-ink">
              {t.footer.privacy}
            </Link>
            {/* Full page load so the admin gets its own (day-only) theme bootstrap. */}
            <a href="/admin" className="hover:text-ink">
              {t.footer.staff}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
