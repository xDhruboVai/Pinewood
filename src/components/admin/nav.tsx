"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/actions/admin";
import { Logo } from "@/components/site/logo";
import type { StaffRole } from "@/lib/types";

// Staff only need two screens: bookings and the menu (Saalim, September 2026).
const LINKS = [
  { href: "/admin/reservations", label: "Reservations", manager: false },
  { href: "/admin/menu", label: "Global menu", ownerOnly: true },
  { href: "/admin/staff", label: "Staff", manager: true },
  { href: "/admin/managers", label: "Managers", manager: false, ownerOnly: true },
];

/** The admin header: the same teal bar, badge logo and Montserrat links as the website's header. */
export function AdminNav({ name, role }: { name: string; role: StaffRole }) {
  const pathname = usePathname();
  const links = LINKS.filter((l) => {
    if (l.ownerOnly) return role === "owner";
    return !l.manager || role === "manager" || role === "owner";
  });

  return (
    <header className="grain grain-dark sticky top-0 z-40 bg-pine-700 text-cream-100">
      {/* Phones: the links get their own row under the logo. */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 px-5 pt-3 pb-1 sm:h-20 sm:flex-nowrap sm:px-8 sm:py-0 lg:px-12">
        <Link href="/admin/reservations" className="order-1 flex shrink-0 items-center">
          <Logo tone="light" subline="Staff" />
        </Link>

        {/* Below 768px: Sign out next to the logo (phones) or at the end of the row (small tablets),
            so a shared device can always be signed out. From 768px it's in the full set on the right. */}
        <form action={signOut} className="order-2 sm:order-3 md:hidden">
          <button type="submit" className="py-2 text-sm text-cream-100/80 hover:text-mustard-300">
            Sign out
          </button>
        </form>

        <nav aria-label="Admin" className="order-3 flex w-full items-center gap-6 sm:order-2 sm:w-auto sm:gap-10 lg:gap-12">
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

        <div className="order-4 hidden items-center gap-6 text-sm md:flex">
          <span className="hidden text-cream-100/70 lg:inline">{name}</span>
          <Link href="/" className="text-cream-100/70 hover:text-mustard-300">
            View the website
          </Link>
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
