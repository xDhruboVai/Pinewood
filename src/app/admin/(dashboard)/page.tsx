import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import { EmptyState, PageHeader, StatCard, StatusBadge, relativeFromNow } from "@/components/admin/ui";
import { LiveRefresh } from "@/components/admin/live-refresh";
import { Badge } from "@/components/ui/badge";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dhakaDate, formatDateLong, formatTime } from "@/lib/format";
import type { AdminReservation } from "@/lib/types";

export const metadata = { title: "Overview" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Dhaka" }).format(new Date()));
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [staff, params] = await Promise.all([requireStaff(), searchParams]);
  const supabase = await createClient();
  const today = dhakaDate();
  const inAWeek = dhakaDate(7);

  const [{ data: todayRows }, { data: upcomingRows }, { count: waitlistCount }] = await Promise.all([
    supabase.rpc("admin_list_reservations", { p_from: today, p_to: today }),
    supabase.rpc("admin_list_reservations", { p_from: today, p_to: inAWeek }),
    supabase.from("waitlist_entries").select("id", { count: "exact", head: true }).eq("status", "waiting"),
  ]);

  const todays = (todayRows ?? []) as AdminReservation[];
  const upcoming = (upcomingRows ?? []) as AdminReservation[];
  const pending = upcoming
    .filter((r) => r.status === "pending")
    .sort((a, b) => (a.expires_at ?? a.starts_at).localeCompare(b.expires_at ?? b.starts_at));
  const cancelRequests = upcoming.filter((r) => r.cancel_requested_at && ["pending", "confirmed"].includes(r.status));
  const activeToday = todays.filter((r) => ["confirmed", "seated", "completed"].includes(r.status));
  const covers = activeToday.reduce((s, r) => s + r.party_size, 0);
  const preorders = todays.filter((r) => r.pre_order && r.pre_order.status !== "cancelled").length;
  const arriving = todays
    .filter((r) => r.status === "confirmed" && new Date(r.ends_at).getTime() > Date.now())
    .slice(0, 8);

  return (
    <div className="space-y-10">
      <LiveRefresh tables={["reservations", "pre_orders", "waitlist_entries"]} />
      <PageHeader title={`Good ${greeting()}, ${staff.fullName.split(" ")[0] || "team"}`} description={formatDateLong(new Date())} />

      {params.error === "forbidden" ? (
        <p role="alert" className="rounded-sm bg-red-50 p-3 text-sm text-red-800">That page is for managers only.</p>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Needs a call" value={pending.length} hint="Pending, next 7 days" tone={pending.length ? "alert" : undefined} />
        <StatCard label="Covers today" value={covers} hint={`${activeToday.length} tables`} />
        <StatCard label="Pre-orders today" value={preorders} />
        <StatCard label="Cancel requests" value={cancelRequests.length} tone={cancelRequests.length ? "alert" : undefined} />
        <StatCard label="Waitlist" value={waitlistCount ?? 0} />
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-ink">Needs a call</h2>
            <Link href="/admin/reservations?status=pending" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
              All pending <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {pending.length === 0 ? <EmptyState>No pending requests. Nice work.</EmptyState> : null}
            {pending.slice(0, 8).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 rounded-sm border border-line bg-surface p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">
                    {r.customer_name} <span className="font-normal text-ink-muted">· {r.party_size}{r.large_party ? "+" : ""} guests</span>
                  </p>
                  <p className="text-sm text-ink-muted">
                    {formatDateLong(r.starts_at).split(",").slice(0, 2).join(",")} · {formatTime(r.starts_at)} · {r.area.name}
                  </p>
                  {r.expires_at ? <p className="mt-1 text-xs text-gold-600">Hold expires {relativeFromNow(r.expires_at)}</p> : null}
                </div>
                <a
                  href={`tel:${r.phone}`}
                  className="inline-flex shrink-0 items-center gap-2 rounded-sm bg-forest-600 px-3 py-2 text-sm font-semibold text-cream-50 hover:bg-forest-700"
                >
                  <Phone className="size-4" /> Call
                </a>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-ink">Arriving today</h2>
            <Link href="/admin/kitchen" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
              Kitchen <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-sm border border-line bg-surface">
            {arriving.length === 0 ? (
              <p className="p-8 text-center text-sm text-ink-muted">No more confirmed arrivals today.</p>
            ) : (
              <ul className="divide-y divide-line">
                {arriving.map((r) => (
                  <li key={r.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                    <span className="w-20 shrink-0 font-semibold tabular-nums text-ink">{formatTime(r.starts_at)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {r.customer_name} · {r.party_size}
                      {r.large_party ? "+" : ""} · {r.area.name}
                      {r.tables.length ? ` · ${r.tables.map((t) => t.label).join(", ")}` : ""}
                    </span>
                    {r.pre_order && r.pre_order.status !== "cancelled" ? <Badge tone="gold">Pre-order</Badge> : null}
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
