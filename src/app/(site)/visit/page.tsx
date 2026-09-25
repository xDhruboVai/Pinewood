import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHero, QuietLink, ScriptTitle } from "@/components/site/section";
import { Reveal } from "@/components/site/reveal";
import { getOpeningHours, getSchedule } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { formatDate, formatTime } from "@/lib/format";
import { SITE, mapsDirectionsUrl, visibleOutlets } from "@/lib/site";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav.visit, description: t.visit.lede };
}

function formatClock(time: string, locale: "en" | "bn") {
  return formatTime(`2000-01-01T${time.slice(0, 5)}:00+06:00`, locale);
}

/**
 * Visit us, in order: 1. intro, 2. the outlets, 3. opening hours and the map, 4. call or get
 * directions. Locations, hours, contact and maps only; photos of the rooms live on About us.
 */
export default async function VisitPage({ searchParams }: { searchParams: Promise<{ outlet?: string }> }) {
  const { locale, t } = await getI18n();
  const outlets = visibleOutlets();
  const { outlet: selectedSlug } = await searchParams;
  // The map shows the outlet picked with "Show on map" (the first outlet by default).
  const selected = outlets.find((o) => o.slug === selectedSlug) ?? outlets[0];
  const [hours, schedule] = await Promise.all([getOpeningHours(), getSchedule(7)]);
  const todayDow = new Date(new Date().toLocaleString("en-US", { timeZone: SITE.timeZone })).getDay();
  const specials = schedule.filter((d) => d.label);
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(selected.mapQuery)}&output=embed`;

  // Show Saturday-first, as the working week runs in Bangladesh.
  const order = [6, 0, 1, 2, 3, 4, 5];

  return (
    <>
      <PageHero eyebrow={t.visit.eyebrow} title={t.visit.title} lede={t.visit.lede} photo={{ name: "outdoorBench", alt: t.photos.outdoorBench.alt, position: "50% 60%" }} />

      {/* 2. The outlets: a plain directory */}
      <section>
        <Container className="grid gap-12 py-24 lg:grid-cols-12 lg:gap-16 lg:py-32">
          <Reveal className="lg:col-span-4">
            <ScriptTitle>{t.visit.outletsTitle}</ScriptTitle>
          </Reveal>
          <ul className="grid gap-x-14 gap-y-14 sm:grid-cols-2 lg:col-span-8 lg:pt-3">
            {outlets.map((o, i) => (
              <Reveal as="li" key={o.slug} delay={(i % 2) * 100}>
                <h2 id={o.slug} className="display scroll-mt-28 text-3xl text-ink">
                  {o.name[locale]}
                </h2>
                <address className="mt-3 leading-relaxed text-ink-muted not-italic">
                  {o.address[locale]}
                  {o.landmark ? <span className="block text-sm">{o.landmark[locale]}</span> : null}
                </address>
                {!o.confirmed ? <p className="mt-2 text-xs text-ink-muted/70">{t.visit.unconfirmed}</p> : null}
                <div className="mt-5 flex flex-wrap gap-x-7 gap-y-2">
                  <QuietLink href={mapsDirectionsUrl(o.mapQuery)} external>
                    {t.visit.directions}
                  </QuietLink>
                  {outlets.length > 1 ? (
                    <Link
                      href={`/visit?outlet=${o.slug}#map`}
                      scroll={false}
                      aria-current={o.slug === selected.slug ? "true" : undefined}
                      className="text-[0.95rem] text-ink-muted transition-colors hover:text-ink aria-[current=true]:text-ink"
                    >
                      {t.visit.showOnMap}
                    </Link>
                  ) : null}
                </div>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

      {/* 3. Opening hours and the map */}
      <section className="bg-surface">
        <Container className="grid gap-14 py-24 lg:grid-cols-12 lg:gap-16 lg:py-32">
          <Reveal className="lg:col-span-4">
            <ScriptTitle>{t.visit.hours}</ScriptTitle>
            <table className="mt-6 w-full">
              <tbody>
                {order.map((dow) => {
                  const h = hours.find((x) => x.weekday === dow);
                  const isToday = dow === todayDow;
                  return (
                    <tr key={dow} className={cn("text-ink-muted", isToday && "text-ink")}>
                      <th scope="row" className={cn("py-1.5 text-left font-normal", isToday && "font-semibold")}>
                        {t.visit.weekdays[dow]}
                        {isToday ? <span className="ml-2 text-sm font-normal text-ink-muted">({t.visit.today})</span> : null}
                      </th>
                      <td className="py-1.5 text-right tabular-nums">
                        {!h || h.is_closed || !h.opens_at || !h.closes_at
                          ? t.visit.closed
                          : `${formatClock(h.opens_at, locale)} – ${formatClock(h.closes_at, locale)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {specials.length > 0 ? (
              <div className="mt-8">
                <p className="font-medium text-ink">{t.visit.specialHours}</p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {specials.map((d) => (
                    <li key={d.day} className="flex justify-between gap-4 text-ink-muted">
                      <span>
                        {formatDate(`${d.day}T12:00:00+06:00`, locale)} · {d.label}
                      </span>
                      <span>{d.opens && d.closes ? `${formatTime(d.opens, locale)} – ${formatTime(d.closes, locale)}` : t.visit.closed}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Reveal>

          <div id="map" className="aspect-[4/3] scroll-mt-28 overflow-hidden bg-surface-2 lg:col-span-8 lg:aspect-auto lg:min-h-[28rem]">
            <iframe
              title={`${t.visit.mapTitle} · ${selected.name[locale]}`}
              src={mapSrc}
              className="h-full w-full grayscale-[35%] sepia-[15%] evening:opacity-90 evening:invert-[88%] evening:hue-rotate-180"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </Container>
      </section>

      {/* 4. Call or get directions */}
      <section className="grain grain-dark bg-pine-700 text-cream-100">
        <Container className="grid gap-10 py-24 lg:grid-cols-12 lg:gap-16 lg:py-28">
          <Reveal className="lg:col-span-4">
            <ScriptTitle light>{t.visit.contactTitle}</ScriptTitle>
            <p className="mt-4 max-w-xs leading-relaxed text-cream-100/70">{t.visit.contactBody}</p>
          </Reveal>
          <Reveal delay={120} className="flex flex-col gap-8 lg:col-span-8 lg:flex-row lg:items-end lg:justify-between lg:pt-3">
            <ul className="space-y-1">
              {SITE.phones.map((p) => (
                <li key={p.tel}>
                  <a href={`tel:${p.tel}`} className="display text-4xl text-cream-50 tabular-nums transition-colors hover:text-mustard-300 sm:text-5xl">
                    {p.display}
                  </a>
                </li>
              ))}
            </ul>
            <ul className="space-y-4">
              {outlets.map((o) => (
                <li key={o.slug}>
                  <p className="text-cream-100/70">{o.name[locale]}</p>
                  <QuietLink href={mapsDirectionsUrl(o.mapQuery)} external light className="mt-1">
                    {t.visit.directions}
                  </QuietLink>
                </li>
              ))}
            </ul>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
