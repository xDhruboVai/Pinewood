import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container, PageHero, QuietLink, ScriptTitle } from "@/components/site/section";
import { Photo } from "@/components/site/photo";
import { Reveal } from "@/components/site/reveal";
import { getI18n } from "@/lib/i18n";
import type { PhotoName } from "@/lib/site";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav.about, description: t.about.lede };
}

// The rooms, in two photo shapes only (4:3 landscape, 4:5 portrait), loosely offset.
const ROOMS: { name: PhotoName; span: string; aspect: string; offset?: string }[] = [
  { name: "muralRoom", span: "md:col-span-7", aspect: "aspect-[4/3]" },
  { name: "outdoorBench", span: "md:col-span-4 md:col-start-9", aspect: "aspect-[4/5]", offset: "md:mt-24" },
  { name: "swingCorner", span: "md:col-span-4 md:col-start-2", aspect: "aspect-[4/5]", offset: "md:-mt-12" },
  { name: "brickRoom", span: "md:col-span-7 md:col-start-6", aspect: "aspect-[4/3]", offset: "md:mt-10" },
  { name: "artRoom", span: "md:col-span-7", aspect: "aspect-[4/3]", offset: "md:mt-10" },
  { name: "balcony", span: "md:col-span-4 md:col-start-9", aspect: "aspect-[4/5]", offset: "md:mt-24" },
  { name: "flowerCorner", span: "md:col-span-7 md:col-start-3", aspect: "aspect-[4/3]", offset: "md:mt-10" },
];

export default async function AboutPage() {
  const { t } = await getI18n();

  return (
    <>
      {/* 1. Intro */}
      <PageHero eyebrow={t.footer.since} title={t.about.title} lede={t.about.lede} photo={{ name: "coffeeCounter", alt: t.photos.coffeeCounter.alt }} />

      {/* 2. What Pinewood is */}
      <section>
        <Container className="grid items-center gap-14 py-24 lg:grid-cols-12 lg:gap-16 lg:py-32">
          <Reveal className="lg:col-span-5">
            <ScriptTitle>{t.about.menuTitle}</ScriptTitle>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-muted">{t.about.menuBody}</p>
            <QuietLink href="/menu" className="mt-6">
              {t.home.ctaMenu}
            </QuietLink>
          </Reveal>
          <Reveal as="figure" delay={120} className="lg:col-span-6 lg:col-start-7">
            <Photo name="foodTable" alt={t.photos.foodTable.alt} sizes="(min-width: 1024px) 45vw, 100vw" className="aspect-[4/5]" />
          </Reveal>
        </Container>
      </section>

      {/* 3. The rooms */}
      <section id="rooms" className="scroll-mt-24 bg-pine-100 evening:bg-pine-800">
        <Container className="py-24 lg:py-32">
          <Reveal className="max-w-xl">
            <ScriptTitle>{t.about.roomsTitle}</ScriptTitle>
            <p className="mt-6 leading-relaxed text-ink-muted">{t.about.roomsBody}</p>
          </Reveal>
          <div className="mt-14 grid gap-x-8 gap-y-12 md:grid-cols-12">
            {ROOMS.map(({ name, span, aspect, offset }, i) => (
              <Reveal as="figure" key={name} delay={(i % 2) * 120} className={cn(span, offset)}>
                <Photo name={name} alt={t.photos[name].alt} sizes="(min-width: 768px) 55vw, 100vw" className={aspect} />
                <figcaption className="mt-3 text-sm text-ink-muted">{t.photos[name].caption}</figcaption>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* 4. The team */}
      <section>
        <Container className="grid items-center gap-14 py-24 lg:grid-cols-12 lg:gap-16 lg:py-32">
          <Reveal className="lg:col-span-4">
            <ScriptTitle>{t.about.teamTitle}</ScriptTitle>
            <p className="mt-6 max-w-xs leading-relaxed text-ink-muted">{t.home.teamTitle}</p>
          </Reveal>
          <Reveal as="figure" delay={120} className="lg:col-span-8">
            <Photo name="team" alt={t.photos.team.alt} sizes="(min-width: 1024px) 65vw, 100vw" className="aspect-[1280/673]" />
          </Reveal>
        </Container>
      </section>

      {/* 5. Come and see us */}
      <section className="grain grain-dark bg-pine-700 text-cream-100">
        <Container className="flex flex-col items-start justify-between gap-8 py-20 md:flex-row md:items-center">
          <h2 className="display text-4xl text-cream-50 sm:text-5xl">{t.about.ctaTitle}</h2>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <Button asChild size="lg" variant="mustard">
              <Link href="/reserve">{t.nav.reserve}</Link>
            </Button>
            <QuietLink href="/visit" light>
              {t.nav.visit}
            </QuietLink>
          </div>
        </Container>
      </section>
    </>
  );
}