"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./logo";
import { LocaleToggle } from "./locale-toggle";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Header() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // On the home page the bar sits over the hero photo, see-through until the page scrolls.
  const overHero = pathname === "/" && !scrolled && !open;

  const links = [
    { href: "/menu", label: t.nav.menu },
    { href: "/visit", label: t.nav.visit },
    { href: "/about", label: t.nav.about },
  ];

  return (
    <header className={cn("sticky top-0 z-40 text-cream-100 transition-colors duration-500", overHero ? "bg-transparent" : "bg-pine-700")}>
      {/* On the home page the header widens from 1536px with the hero (hero-carousel.tsx), so a large
          screen isn't framed by empty green, and grows (taller bar, larger badge) to suit the hero's
          larger type. Other pages keep it in line with their content. */}
      <div
        className={cn(
          "mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8 lg:px-12",
          pathname === "/" && "2xl:h-24 2xl:max-w-[110rem] 2xl:px-[4.5vw]",
        )}
      >
        <Link href="/" aria-label={t.nav.home} className="flex shrink-0 items-center">
          <Logo tone="light" priority className={pathname === "/" ? "2xl:[&_img]:h-[4.5rem]" : undefined} />
        </Link>

        {/* Tighter between 768 and 1023px so the links and the Reserve button fit on one line. */}
        <nav aria-label="Primary" className="hidden items-center gap-5 md:flex lg:gap-12">
          {[{ href: "/", label: t.nav.home }, ...links].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={(l.href === "/" ? pathname === "/" : pathname.startsWith(l.href)) ? "page" : undefined}
              className="font-nav relative py-2 text-[0.8rem] font-medium tracking-[0.12em] whitespace-nowrap text-cream-50 uppercase lg:tracking-[0.16em] transition-colors after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:bg-mustard-400 after:opacity-0 after:transition-opacity hover:text-mustard-300 aria-[current=page]:text-mustard-400 aria-[current=page]:after:opacity-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-5 md:flex lg:gap-6">
          <LocaleToggle />
          <Button asChild variant="mustard" className="font-nav h-12 px-5 text-[0.8rem] tracking-[0.16em] lg:px-7">
            <Link href="/reserve">{t.nav.reserve}</Link>
          </Button>
        </div>

        <button
          type="button"
          className="-mr-2 inline-flex size-10 items-center justify-center text-cream-100 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      <div id="mobile-nav" hidden={!open} className="grain grain-dark h-[calc(100dvh-5rem)] overflow-y-auto bg-pine-700 px-5 pt-4 pb-10 md:hidden">
        <nav aria-label="Mobile" className="flex flex-col">
          {[{ href: "/", label: t.nav.home }, ...links].map((l) => (
            <Link key={l.href} href={l.href} className="display py-3.5 text-4xl text-cream-100">
              {l.label}
            </Link>
          ))}
        </nav>
        <Button asChild variant="mustard" size="lg" className="font-nav mt-8 w-full tracking-[0.16em]">
          <Link href="/reserve">{t.nav.reserve}</Link>
        </Button>
        <div className="mt-8 flex items-center justify-between">
          <LocaleToggle />
          <a href={`tel:${SITE.phones[0].tel}`} className="label text-cream-100/80">
            {SITE.phones[0].display}
          </a>
        </div>
      </div>
    </header>
  );
}
