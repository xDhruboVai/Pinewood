"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/actions/admin";
import { Logo } from "@/components/site/logo";
import type { StaffRole } from "@/lib/types";

// Staff only need two screens: bookings and the menu.
const LINKS = [
  { href: "/admin/reservations", label: "Reservations", manager: false },
  { href: "/admin/menu", label: "Menu", manager: true },
];

/** The admin header: the same teal bar, badge logo and Montserrat links as the website's header. */
export function AdminNav({ name, role }: { name: string; role: StaffRole }) {
  const pathname = usePathname();
  const links = LINKS.filter((l) => !l.manager || role === "manager");

  return (
    <header className="grain grain-dark sticky top-0 z-40 bg-pine-700 text-cream-100">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
        <Link href="/admin/reservations" className="flex shrink-0 items-center">
          <Logo tone="light" subline="Admin" />
        </Link>

        <nav aria-label="Admin" className="flex items-center gap-6 sm:gap-10 lg:gap-12">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname.startsWith(l.href) ? "page" : undefined}
              className="font-nav relative py-2 text-[0.72rem] font-medium tracking-[0.16em] text-cream-50 uppercase transition-colors after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:bg-mustard-400 after:opacity-0 after:transition-opacity hover:text-mustard-300 aria-[current=page]:text-mustard-400 aria-[current=page]:after:opacity-100 sm:text-[0.8rem]"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-6 text-sm md:flex">
          <span className="text-cream-100/70">{name}</span>
          <a href="/" className="text-cream-100/70 hover:text-mustard-300">
            View the website
          </a>
          <form action={signOut}>
            <button type="submit" className="text-cream-100/70 hover:text-mustard-300">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
