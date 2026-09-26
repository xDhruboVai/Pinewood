"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/actions/admin";
import { Logo } from "@/components/site/logo";

const LINKS = [
  { href: "/manager/menu", label: "Branch menu" },
  { href: "/manager/staff", label: "Staff" },
];

export function ManagerNav({ name }: { name: string }) {
  const pathname = usePathname();

  return (
    <header className="grain grain-dark sticky top-0 z-40 bg-pine-700 text-cream-100">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
        <Link href="/manager" className="shrink-0"><Logo tone="light" subline="Manager" /></Link>
        <nav aria-label="Manager" className="flex items-center gap-5 sm:gap-8">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} aria-current={pathname.startsWith(link.href) ? "page" : undefined} className="font-nav py-2 text-xs text-cream-100/75 hover:text-mustard-300 aria-[current=page]:text-mustard-400 sm:text-sm">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-5 text-sm md:flex">
          <span className="text-cream-100/70">{name}</span>
          <form action={signOut}><button type="submit" className="text-cream-100/70 hover:text-mustard-300">Sign out</button></form>
        </div>
        <form action={signOut} className="md:hidden"><button type="submit" className="text-sm text-cream-100/70">Sign out</button></form>
      </div>
    </header>
  );
}