"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./logo";
import { LocaleToggle } from "./locale-toggle";
import { AmbianceToggle } from "./ambiance";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function Header() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const links = [
    { href: "/menu", label: t.nav.menu },
    { href: "/ambiance", label: t.nav.ambiance },
    { href: "/visit", label: t.nav.visit },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-500",
        scrolled || open ? "border-line bg-canvas/85 backdrop-blur-md" : "border-transparent bg-canvas/0",
      )}
    >
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-10">
        <Link href="/" aria-label={t.nav.home} className="shrink-0">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-9 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname.startsWith(l.href) ? "page" : undefined}
              className="relative text-sm font-medium text-ink-muted transition-colors hover:text-ink aria-[current=page]:text-ink after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-accent after:transition-transform aria-[current=page]:after:scale-x-100 hover:after:scale-x-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          <AmbianceToggle />
          <LocaleToggle />
          <Button asChild size="md" className="ml-2">
            <Link href="/reserve">{t.nav.reserve}</Link>
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-full text-ink md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <div
        id="mobile-nav"
        hidden={!open}
        className="h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-line bg-canvas px-4 pt-6 pb-10 md:hidden"
      >
        <nav aria-label="Mobile" className="flex flex-col">
          {[{ href: "/", label: t.nav.home }, ...links].map((l) => (
            <Link key={l.href} href={l.href} className="display border-b border-line py-4 text-3xl text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <Button asChild size="lg" className="mt-8 w-full">
          <Link href="/reserve">{t.nav.reserve}</Link>
        </Button>
        <div className="mt-6 flex items-center gap-3">
          <AmbianceToggle />
          <LocaleToggle />
        </div>
      </div>
    </header>
  );
}
