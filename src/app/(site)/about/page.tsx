import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container, PageHero, QuietLink, ScriptTitle } from "@/components/site/section";
import { Photo } from "@/components/site/photo";
import { Reveal } from "@/components/site/reveal";
import { getI18n } from "@/lib/i18n";
import type { PhotoName } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav.about, description: t.about.lede };
}

// The rooms, in three rows: two photos, three, then two. Every photo in a row is cropped to the same
// height, so the rows line up edge to edge with no staggered gaps between them. On phones each photo
// keeps its own shape, one under the other.
const WIDE_ROW = "md:aspect-auto md:h-[clamp(17rem,30vw,32rem)]";
const THREE_ROW = "md:aspect-auto md:h-[clamp(14rem,24vw,26rem)]";
const ROOMS: { name: PhotoName; span: string; shape: string; position?: string }[] = [
  { name: "muralRoom", span: "md:col-span-7", shape: `aspect-[4/3] ${WIDE_ROW}` },
  { name: "outdoorBench", span: "md:col-span-5", shape: `aspect-[4/5] ${WIDE_ROW}` },
  { name: "swingCorner", span: "md:col-span-4", shape: `aspect-[4/5] ${THREE_ROW}`, position: "50% 40%" },
  { name: "brickRoom", span: "md:col-span-4", shape: `aspect-[4/3] ${THREE_ROW}` },
  { name: "balcony", span: "md:col-span-4", shape: `aspect-[4/3] ${THREE_ROW}` },
  { name: "artRoom", span: "md:col-span-5", shape: `aspect-[4/3] ${WIDE_ROW}` },
  { name: "flowerCorner", span: "md:col-span-7", shape: `aspect-[4/3] ${WIDE_ROW}` },
];

export default async function AboutPage() {
  const { t } = await getI18n();

  return (
    <>
      {/* 1. Intro */}
      <PageHero eyebrow={t.footer.since} title={t.about.title} lede={t.about.lede} photo={{ name: "coffeeCounter", alt: t.photos.coffeeCounter.alt }} />

      {/* 2. What Pinewood is */}
      <section>
        {/* On desktop the photo is cropped shorter and wider (the plates are in its lower half), so the
            few lines beside it don't float in a tall, empty column. */}
        <Container className="grid items-center gap-12 py-20 lg:grid-cols-12 lg:gap-16 lg:py-24">
          <Reveal className="lg:col-span-5">
            <ScriptTitle>{t.about.menuTitle}</ScriptTitle>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-muted xl:text-xl">{t.about.menuBody}</p>
            <QuietLink href="/menu" className="mt-6">
              {t.home.ctaMenu}
            </QuietLink>
          </Reveal>
          <Reveal as="figure" delay={120} className="lg:col-span-7">
            <Photo
              name="foodTable"
              alt={t.photos.foodTable.alt}
              sizes="(min-width: 1024px) 55vw, 100vw"
              position="50% 68%"
              className="aspect-[4/5] sm:aspect-[4/3] lg:aspect-auto lg:h-[clamp(22rem,30vw,32rem)]"
            />
          </Reveal>
        </Container>
      </section>

      {/* 3. The rooms */}
      <section id="rooms" className="scroll-mt-24 bg-pine-100 evening:bg-pine-800">
        <Container className="py-20 lg:py-24">
          <Reveal className="max-w-xl">
            <ScriptTitle>{t.about.roomsTitle}</ScriptTitle>
            <p className="mt-6 leading-relaxed text-ink-muted">{t.about.roomsBody}</p>
          </Reveal>
          <div className="mt-10 grid gap-x-5 gap-y-8 md:grid-cols-12 lg:mt-12 lg:gap-x-6 lg:gap-y-10">
            {ROOMS.map(({ name, span, shape, position }, i) => (
              <Reveal as="figure" key={name} delay={(i % 3) * 100} className={span}>
                <Photo name={name} alt={t.photos[name].alt} sizes="(min-width: 768px) 55vw, 100vw" position={position} className={shape} />
                <figcaption className="mt-3 text-sm text-ink-muted">{t.photos[name].caption}</figcaption>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* 4. The team: title and line centred over a centred group photo, so the photo is the whole
          section rather than sharing it with a short line of text. */}
      <section>
        <Container className="py-20 lg:py-24">
          <Reveal className="text-center">
            <ScriptTitle className="pl-0">{t.about.teamTitle}</ScriptTitle>
            <p className="mt-4 leading-relaxed text-ink-muted">{t.home.teamTitle}</p>
          </Reveal>
          <Reveal as="figure" delay={120} className="mx-auto mt-10 max-w-5xl lg:mt-12">
            <Photo name="team" alt={t.photos.team.alt} sizes="(min-width: 1024px) 64rem, 100vw" className="aspect-[1280/673]" />
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