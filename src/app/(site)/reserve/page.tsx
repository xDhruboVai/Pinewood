import type { Metadata } from "next";
import { Container, PageHero, QuietLink, ScriptTitle } from "@/components/site/section";
import { BookingFlow } from "@/components/reserve/booking-flow";
import { Reveal } from "@/components/site/reveal";
import { getAreas, getBranches } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { SITE, mapsDirectionsUrl, visibleOutlets } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.reserve.title, description: t.reserve.lede };
}

/**
 * Reserve a table, in order: 1. intro, 2. the booking form, 3. good to know (holds, confirmation,
 * pre-orders, groups and changes), 4. call us. The "good to know" copy states the rules in
 * SITE.booking (10-minute hold, 60-minute pre-order cutoff, 10 guests online); keep them in step.
 */
export default async function ReservePage() {
  const [{ locale, t }, areas, branches] = await Promise.all([getI18n(), getAreas(), getBranches()]);
  const outlets = visibleOutlets();

  return (
    <>
      {/* 1. Intro */}
      <PageHero eyebrow={t.reserve.eyebrow} title={t.reserve.title} lede={t.reserve.lede} photo={{ name: "muralRoom", alt: t.photos.muralRoom.alt }} />

      {/* 2. The booking form */}
      <section>
        <Container className="py-16 lg:py-24">
          <BookingFlow areas={areas} branches={branches} />
        </Container>
      </section>

      {/* 3. Good to know */}
      <section className="bg-surface">
        <Container className="grid gap-14 py-24 lg:grid-cols-12 lg:gap-16 lg:py-32">
          <Reveal className="lg:col-span-4">
            <ScriptTitle>{t.reserve.infoTitle}</ScriptTitle>
          </Reveal>
          <dl className="grid gap-x-14 gap-y-10 sm:grid-cols-2 lg:col-span-8 lg:pt-3 xl:gap-x-20">
            {t.reserve.info.map((item, i) => (
              <Reveal key={item.title} delay={(i % 2) * 100}>
                <dt className="display text-2xl text-ink">{item.title}</dt>
                <dd className="mt-2 text-base leading-relaxed text-ink-muted xl:text-lg">{item.body}</dd>
              </Reveal>
            ))}
          </dl>
        </Container>
      </section>

      {/* 4. Call or get directions: three columns aligned at the top (intro, numbers, outlets), perfectly filling wide monitors without dead space */}
      <section className="grain grain-dark bg-pine-700 text-cream-100">
        <Container className="grid gap-12 py-20 lg:grid-cols-12 lg:gap-16 lg:py-24">
          <Reveal className="lg:col-span-4">
            <ScriptTitle light>{t.visit.contactTitle}</ScriptTitle>
            <p className="mt-4 max-w-xs leading-relaxed text-cream-100/70">{t.visit.contactBody}</p>
          </Reveal>
          <Reveal delay={100} className="lg:col-span-4 lg:border-l lg:border-cream-100/15 lg:pl-12 xl:col-span-3">
            <p className="eyebrow !text-mustard-400">{t.reserve.phone}</p>
            <ul className="mt-5 space-y-3">
              {SITE.phones.map((p) => (
                <li key={p.tel}>
                  <a
                    href={`tel:${p.tel}`}
                    className="text-[1.9rem] leading-tight font-medium tracking-[0.01em] whitespace-nowrap text-cream-50 tabular-nums transition-colors hover:text-mustard-300 sm:text-[2.1rem]"
                  >
                    {p.display}
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={200} className="lg:col-span-4 lg:border-l lg:border-cream-100/15 lg:pl-12 xl:col-span-5">
            <p className="eyebrow !text-mustard-400">{t.visit.outletsTitle}</p>
            <ul className="mt-5 space-y-4">
              {outlets.map((o) => (
                <li key={o.slug} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-5 gap-y-1 lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto]">
                  <span className="text-cream-100/80">{o.name[locale]}</span>
                  <QuietLink href={mapsDirectionsUrl(o.mapQuery)} external light>
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
