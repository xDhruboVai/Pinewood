import Link from "next/link";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { BarChart, HBarList } from "@/components/admin/charts";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Analytics } from "@/lib/types";

export const metadata = { title: "Analytics" };

const RANGES = [7, 30, 90];

function hourLabel(h: number) {
  const suffix = h < 12 ? "am" : "pm";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${suffix}`;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireManager();
  const params = await searchParams;
  const days = RANGES.includes(Number(params.days)) ? Number(params.days) : 30;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_analytics", { p_days: days });
  const a = (data ?? { daily_covers: [], peak_hours: [], top_items: [], totals: { requests: 0, confirmed: 0, no_shows: 0, expired: 0, covers: 0 } }) as Analytics;

  const confirmRate = a.totals.requests ? Math.round((a.totals.confirmed / a.totals.requests) * 100) : 0;
  const noShowRate = a.totals.confirmed ? Math.round((a.totals.no_shows / a.totals.confirmed) * 100) : 0;
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, covers: a.peak_hours.find((p) => p.hour === h)?.covers ?? 0 })).filter(
    (h, _, arr) => h.hour >= Math.min(...arr.filter((x) => x.covers > 0).map((x) => x.hour), 10) && h.hour <= Math.max(...arr.filter((x) => x.covers > 0).map((x) => x.hour), 21),
  );

  return (
    <div className="space-y-8">
      <PageHeader title="Analytics" description="Covers, busy hours and what guests pre-order.">
        <div className="flex rounded-sm border border-line bg-surface p-0.5" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/analytics?days=${r}`}
              aria-current={r === days ? "true" : undefined}
              className={cn("rounded-sm px-3 py-1.5 text-sm", r === days ? "bg-forest-600 text-cream-50" : "text-ink-muted hover:text-ink")}
            >
              {r} days
            </Link>
          ))}
        </div>
      </PageHeader>

      {error ? <p className="rounded-sm bg-red-50 p-3 text-sm text-red-800">{error.message}</p> : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Covers" value={a.totals.covers} hint={`Confirmed guests, last ${days} days`} />
        <StatCard label="Requests" value={a.totals.requests} hint={`${a.totals.confirmed} confirmed`} />
        <StatCard label="Confirmation rate" value={`${confirmRate}%`} hint={`${a.totals.expired} expired unreachable`} />
        <StatCard label="No-show rate" value={`${noShowRate}%`} hint={`${a.totals.no_shows} no-shows`} />
      </div>

      <section className="rounded-sm border border-line bg-surface p-5">
        <h2 className="font-display text-2xl text-ink">Daily covers</h2>
        <p className="text-sm text-ink-muted">Guests on confirmed, seated and completed reservations.</p>
        <BarChart
          className="mt-6"
          data={a.daily_covers.map((d) => ({
            key: d.day,
            label: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${d.day}T12:00:00+06:00`)),
            value: Number(d.covers),
            detail: `${d.bookings} booking${Number(d.bookings) === 1 ? "" : "s"}`,
          }))}
          unit="covers"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-sm border border-line bg-surface p-5">
          <h2 className="font-display text-2xl text-ink">Peak hours</h2>
          <p className="text-sm text-ink-muted">Covers by reservation start time (Dhaka).</p>
          <BarChart className="mt-6" data={hours.map((h) => ({ key: String(h.hour), label: hourLabel(h.hour), value: Number(h.covers) }))} unit="covers" />
        </section>

        <section className="rounded-sm border border-line bg-surface p-5">
          <h2 className="font-display text-2xl text-ink">Top pre-ordered dishes</h2>
          <p className="text-sm text-ink-muted">Quantity ordered ahead, excluding cancelled pre-orders.</p>
          <HBarList
            className="mt-6"
            data={a.top_items.map((t) => ({ key: t.name, label: t.name, value: Number(t.quantity), detail: formatPrice(Number(t.revenue)) }))}
          />
        </section>
      </div>
    </div>
  );
}
