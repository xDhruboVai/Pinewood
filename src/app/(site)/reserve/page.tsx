import type { Metadata } from "next";
import { Container, PageHero, ScriptTitle } from "@/components/site/section";
import { BookingFlow } from "@/components/reserve/booking-flow";
import { Reveal } from "@/components/site/reveal";
import { getAreas } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { SITE } from "@/lib/site";

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
  const [{ t }, areas] = await Promise.all([getI18n(), getAreas()]);

  return (
    <>
      {/* 1. Intro */}
      <PageHero eyebrow={t.reserve.eyebrow} title={t.reserve.title} lede={t.reserve.lede} photo={{ name: "muralRoom", alt: t.photos.muralRoom.alt }} />

      {/* 2. The booking form */}
      <section>
        <Container className="py-16 lg:py-24">
          <BookingFlow areas={areas} />
        </Container>
      </section>

      {/* 3. Good to know */}
      <section className="bg-surface">
        <Container className="grid gap-14 py-24 lg:grid-cols-12 lg:gap-16 lg:py-32">
          <Reveal className="lg:col-span-4">
            <ScriptTitle>{t.reserve.infoTitle}</ScriptTitle>
          </Reveal>
          <dl className="grid gap-x-14 gap-y-10 sm:grid-cols-2 lg:col-span-8 lg:pt-3">
            {t.reserve.info.map((item, i) => (
              <Reveal key={item.title} delay={(i % 2) * 100}>
                <dt className="display text-2xl text-ink">{item.title}</dt>
                <dd className="mt-2 leading-relaxed text-ink-muted">{item.body}</dd>
              </Reveal>
            ))}
          </dl>
        </Container>
      </section>

      {/* 4. Call us */}
      <section className="grain grain-dark bg-pine-700 text-cream-100">
        <Container className="grid gap-10 py-24 lg:grid-cols-12 lg:gap-16 lg:py-28">
          <Reveal className="lg:col-span-4">
            <ScriptTitle light>{t.visit.contactTitle}</ScriptTitle>
            <p className="mt-4 max-w-xs leading-relaxed text-cream-100/70">{t.visit.contactBody}</p>
          </Reveal>
          <Reveal delay={120} className="lg:col-span-8 lg:pt-3">
            <ul className="space-y-1">
              {SITE.phones.map((p) => (
                <li key={p.tel}>
                  <a href={`tel:${p.tel}`} className="display text-4xl text-cream-50 tabular-nums transition-colors hover:text-mustard-300 sm:text-5xl">
                    {p.display}
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
