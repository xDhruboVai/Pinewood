"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarClock, ChefHat, LayoutDashboard, LogOut, SlidersHorizontal, UsersRound, UtensilsCrossed } from "lucide-react";
import { signOut } from "@/actions/admin";
import { Logo } from "@/components/site/logo";
import { cn } from "@/lib/utils";
import type { StaffRole } from "@/lib/types";

const LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, manager: false },
  { href: "/admin/reservations", label: "Reservations", icon: CalendarClock, manager: false },
  { href: "/admin/kitchen", label: "Kitchen", icon: ChefHat, manager: false },
  { href: "/admin/availability", label: "Availability", icon: SlidersHorizontal, manager: false },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed, manager: true },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, manager: true },
  { href: "/admin/staff", label: "Staff", icon: UsersRound, manager: true },
];

export function AdminNav({ name, role }: { name: string; role: StaffRole }) {
  const pathname = usePathname();
  const links = LINKS.filter((l) => !l.manager || role === "manager");
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <aside className="sticky top-0 z-30 border-b border-line bg-surface lg:h-dvh lg:border-r lg:border-b-0">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-4 lg:px-6 lg:py-7">
          <Link href="/admin">
            <Logo subline="Admin" />
          </Link>
          <form action={signOut} className="lg:hidden">
            <button type="submit" aria-label="Sign out" className="inline-flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-4">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                isActive(href) ? "bg-forest-600 text-cream-50" : "text-ink-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-line p-4 lg:block">
          <p className="truncate text-sm font-semibold text-ink">{name}</p>
          <p className="text-xs text-ink-muted capitalize">{role === "foh" ? "Front of house" : "Manager"}</p>
          <div className="mt-3 flex items-center justify-between">
            <a href="/" className="text-xs text-ink-muted hover:text-ink">
              View site ↗
            </a>
            <form action={signOut}>
              <button type="submit" className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
                <LogOut className="size-3.5" /> Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}
