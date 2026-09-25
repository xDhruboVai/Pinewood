import Link from "next/link";
import { LogoStacked } from "./logo";
import { AmbianceToggle } from "./ambiance";
import { getI18n } from "@/lib/i18n";
import { SITE, visibleOutlets } from "@/lib/site";
import type { MenuSection } from "@/lib/types";

const MENU_SECTIONS: MenuSection[] = ["starters", "mains", "coffee", "desserts", "beverages"];

const heading = "font-medium text-cream-50";
const link = "text-cream-100/75 transition-colors hover:text-cream-100";

export async function Footer() {
  const { locale, t } = await getI18n();
  const year = new Date().getFullYear();
  const outlets = visibleOutlets();

  const pages = [
    { href: "/", label: t.nav.home },
    { href: "/menu", label: t.nav.menu },
    { href: "/visit", label: t.nav.visit },
    { href: "/about", label: t.nav.about },
    { href: "/reserve", label: t.nav.reserve },
  ];

  return (
    <footer className="grain grain-dark bg-pine-900 text-cream-100">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr_1.4fr] lg:px-12">
        <div>
          <LogoStacked className="h-28" />
          <p className="script mt-5 text-3xl text-mustard-400 lowercase">{t.footer.since}</p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-cream-100/70">{t.footer.tagline}</p>
        </div>

        <nav aria-label={t.footer.menuTitle}>
          <p className={heading}>{t.footer.menuTitle}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {MENU_SECTIONS.map((section) => (
              <li key={section}>
                <Link href={`/menu#section-${section}`} className={link}>
                  {t.menu.sections[section]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t.footer.pagesTitle}>
          <p className={heading}>{t.footer.pagesTitle}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {pages.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className={link}>
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className={heading}>{t.footer.contactTitle}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {SITE.phones.map((p) => (
              <li key={p.tel}>
                <a href={`tel:${p.tel}`} className={link}>
                  {p.display}
                </a>
              </li>
            ))}
            {/* Hours come from the booking system and can differ by branch, so link to them instead of repeating them. */}
            <li>
              <Link href="/visit#hours" className={link}>
                {t.footer.hours}
              </Link>
            </li>
            <li>
              <a href={SITE.social.facebook} target="_blank" rel="noopener noreferrer" className={link}>
                Facebook
              </a>
            </li>
          </ul>
          <p className={`${heading} mt-10`}>{t.footer.outletsTitle}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {outlets.map((o) => (
              <li key={o.slug}>
                <Link href={`/visit?outlet=${o.slug}#map`} className={link}>
                  {o.name[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-cream-100/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-6 text-xs text-cream-100/55 sm:px-8 lg:px-12">
          <p>
            © {year} Pinewood Cafe + Kitchen. {t.footer.rights}
          </p>
          <div className="flex flex-wrap items-center gap-6">
            <AmbianceToggle />
            <Link href="/privacy" className="hover:text-cream-100">
              {t.footer.privacy}
            </Link>
            {/* Full page load so the admin gets its own (day-only) theme bootstrap. */}
            <a href="/admin" className="hover:text-cream-100">
              {t.footer.staff}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
