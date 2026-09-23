import type { Metadata } from "next";
import { MapPin, Navigation, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, PageHero } from "@/components/site/section";
import { getOpeningHours, getSchedule } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { formatDate, formatTime } from "@/lib/format";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav.visit, description: SITE.address.en };
}

function formatClock(time: string, locale: "en" | "bn") {
  return formatTime(`2000-01-01T${time.slice(0, 5)}:00+06:00`, locale);
}

export default async function VisitPage() {
  const { locale, t } = await getI18n();
  const [hours, schedule] = await Promise.all([getOpeningHours(), getSchedule(7)]);
  const todayDow = new Date(new Date().toLocaleString("en-US", { timeZone: SITE.timeZone })).getDay();
  const specials = schedule.filter((d) => d.label);
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(SITE.mapQuery)}&output=embed`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(SITE.mapQuery)}`;

  // Show Saturday-first, as the working week runs in Bangladesh.
  const order = [6, 0, 1, 2, 3, 4, 5];

  return (
    <>
      <PageHero eyebrow={t.visit.eyebrow} title={t.visit.title} />
      <Container className="grid gap-12 py-16 lg:grid-cols-[1fr_1.3fr] lg:py-24">
        <div className="space-y-12">
          <section>
            <p className="eyebrow">{t.visit.address}</p>
            <address className="mt-4 flex gap-3 text-lg leading-relaxed text-ink not-italic">
              <MapPin className="mt-1.5 size-5 shrink-0 text-accent-ink" aria-hidden />
              <span>
                {SITE.address[locale]}
                <span className="block text-base text-ink-muted">{SITE.address.landmark[locale]}</span>
              </span>
            </address>
            <Button asChild variant="outline" className="mt-5">
              <a href={directions} target="_blank" rel="noopener noreferrer">
                <Navigation />
                {t.visit.directions}
              </a>
            </Button>
          </section>

          <section>
            <p className="eyebrow">{t.visit.phones}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {SITE.phones.map((p) => (
                <Button key={p.tel} asChild size="lg">
                  <a href={`tel:${p.tel}`}>
                    <Phone />
                    {p.display}
                  </a>
                </Button>
              ))}
            </div>
          </section>

          <section>
            <p className="eyebrow">{t.visit.hours}</p>
            <table className="mt-4 w-full text-sm">
              <tbody>
                {order.map((dow) => {
                  const h = hours.find((x) => x.weekday === dow);
                  const isToday = dow === todayDow;
                  return (
                    <tr key={dow} className={cn("border-b border-line", isToday && "font-semibold text-ink")}>
                      <th scope="row" className="py-3 text-left font-normal">
                        {t.visit.weekdays[dow]}
                        {isToday ? <span className="ml-2 text-xs text-accent-ink">· {t.visit.today}</span> : null}
                      </th>
                      <td className="py-3 text-right text-ink-muted">
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
              <div className="mt-6 rounded-sm border border-accent/40 bg-accent/5 p-5">
                <p className="text-xs font-semibold tracking-[0.18em] text-accent-ink uppercase">{t.visit.specialHours}</p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {specials.map((d) => (
                    <li key={d.day} className="flex justify-between gap-4">
                      <span>
                        {formatDate(`${d.day}T12:00:00+06:00`, locale)} · {d.label}
                      </span>
                      <span className="text-ink-muted">
                        {d.opens && d.closes ? `${formatTime(d.opens, locale)} – ${formatTime(d.closes, locale)}` : t.visit.closed}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>

        <div className="min-h-[420px] overflow-hidden rounded-sm border border-line bg-surface-2 lg:min-h-full">
          <iframe
            title={t.visit.mapTitle}
            src={mapSrc}
            className="h-full min-h-[420px] w-full grayscale-[35%] sepia-[15%] evening:opacity-90 evening:invert-[88%] evening:hue-rotate-180"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </Container>
    </>
  );
}
