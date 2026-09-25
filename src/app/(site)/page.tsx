import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container, QuietLink, ScriptTitle } from "@/components/site/section";
import { DishStrip, type DishPhoto } from "@/components/site/dish-cards";
import { HomeHero } from "@/components/site/home-hero";
import { Photo } from "@/components/site/photo";
import { Reveal } from "@/components/site/reveal";
import { getMenu, getSchedule } from "@/lib/data";
import { getI18n, pick } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import { GUEST_REVIEWS } from "@/lib/reviews";
import { DISH_PHOTOS, PHOTOS, SITE, mapsSearchUrl, type PhotoName } from "@/lib/site";

// Food photos without a sure menu match, shown as a photo wall (two shapes, alternating).
const TABLES: PhotoName[] = ["steakSet", "shashlikSet", "alfredoBake", "setMenus", "spaghetti", "breakfastPlate", "coffeeCup", "potatoWedges", "chickenRicePlate", "clubSandwichPlatter", "skewerPlate"];

/**
 * Home, in order: 1. brand and signature food (hero), 2. more of the food, 3. the rooms,
 * 4. what guests say, 5. the way to a reservation. Locations live on Visit us and the team on
 * About us; don't add them back here.
 */
export default async function HomePage() {
  const { locale, t } = await getI18n();
  const [menu, schedule] = await Promise.all([getMenu(), getSchedule(1)]);

  const items = menu.flatMap((c) => c.menu_items.filter((i) => i.is_available).map((i) => ({ i, c })));
  const featured = items.filter(({ i }) => i.is_featured).slice(0, 6);
  const photographed: DishPhoto[] = items
    .filter(({ i }) => DISH_PHOTOS[i.slug])
    .map(({ i, c }) => {
      const photo = DISH_PHOTOS[i.slug];
      return {
        key: i.id,
        name: pick(i, "name", locale),
        price: formatPrice(i.price, locale),
        href: `/menu#section-${c.section}`,
        src: PHOTOS[photo].src,
        alt: t.photos[photo].alt,
      };
    });
  const [lead, ...otherReviews] = GUEST_REVIEWS;

  return (
    <>
      {/* 1. Brand and signature food */}
      <HomeHero locale={locale} t={t} menu={menu} today={schedule[0]} />

      {/* 2. More of the food, set like the menu page */}
      {featured.length > 0 || photographed.length > 0 ? (
        <section className="overflow-hidden">
          <Container className="grid gap-14 py-24 lg:grid-cols-12 lg:gap-16 lg:py-32">
            <Reveal className="lg:col-span-5">
              <ScriptTitle>{t.home.kitchenTitle}</ScriptTitle>
              <ul className="mt-8 space-y-5">
                {featured.map(({ i }) => (
                  <li key={i.id} className="grid grid-cols-[1fr_auto] items-baseline gap-x-4">
                    <span className="text-[0.95rem] font-semibold tracking-[0.03em] text-ink uppercase">{pick(i, "name", locale)}</span>
                    <span className="text-[0.95rem] font-semibold tabular-nums text-ink">{formatPrice(i.price, locale)}</span>
                    {pick(i, "description", locale) ? (
                      <span className="col-span-2 mt-0.5 text-sm leading-relaxed text-ink-muted">{pick(i, "description", locale)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <QuietLink href="/menu" className="mt-10">
                {t.home.signatureCta}
              </QuietLink>
            </Reveal>
            {photographed.length > 0 ? (
              <Reveal delay={120} className="min-w-0 lg:col-span-7">
                <DishStrip dishes={photographed} label={t.home.kitchenTitle} />
                <p className="mt-6 text-sm text-ink-muted">{t.home.dishesHint}</p>
              </Reveal>
            ) : null}
          </Container>
        </section>
      ) : null}

      {/* 2b. From our tables: a photo wall of more food */}
      <section className="bg-surface">
        <Container className="py-24 lg:py-32">
          <Reveal>
            <ScriptTitle>{t.home.tablesTitle}</ScriptTitle>
          </Reveal>
          <div className="mt-12 gap-5 columns-2 md:columns-3 lg:columns-4">
            {TABLES.map((name, i) => (
              <Reveal as="figure" key={name} delay={(i % 4) * 80} className="mb-5 break-inside-avoid">
                <Photo name={name} alt={t.photos[name].alt} sizes="(min-width: 1024px) 24vw, (min-width: 768px) 32vw, 50vw" className={i % 3 === 1 ? "aspect-[4/3]" : "aspect-[4/5]"} />
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* 3. The rooms */}
      <section className="bg-pine-100 evening:bg-pine-800">
        <Container className="grid gap-14 py-24 lg:grid-cols-12 lg:gap-16 lg:py-32">
          <Reveal as="figure" className="lg:col-span-7">
            <Photo name="windowRoom" alt={t.photos.windowRoom.alt} sizes="(min-width: 1024px) 55vw, 100vw" className="aspect-[4/3]" />
            <figcaption className="mt-3 text-sm text-ink-muted">{t.photos.windowRoom.caption}</figcaption>
          </Reveal>
          <Reveal delay={120} className="flex flex-col lg:col-span-5">
            <ScriptTitle>{t.home.insideTitle}</ScriptTitle>
            <p className="mt-6 max-w-sm leading-relaxed text-ink-muted">{t.about.roomsBody}</p>
            <QuietLink href="/about#rooms" className="mt-6">
              {t.home.insideCta}
            </QuietLink>
            <figure className="mt-12 hidden w-3/5 lg:block">
              <Photo name="coffeeCounter" alt={t.photos.coffeeCounter.alt} sizes="25vw" className="aspect-[4/5]" position="40% 50%" />
              <figcaption className="mt-3 text-sm text-ink-muted">{t.photos.coffeeCounter.caption}</figcaption>
            </figure>
          </Reveal>
        </Container>
      </section>

      {/* 4. What guests say */}
      <section>
        <Container className="py-24 lg:py-32">
          <Reveal className="grid gap-8 lg:grid-cols-12 lg:gap-16">
            <ScriptTitle className="lg:col-span-4 lg:pt-3">{t.home.reviewsTitle}</ScriptTitle>
            <figure className="lg:col-span-8">
              <blockquote lang="en" className="display text-3xl leading-snug text-ink sm:text-4xl lg:text-[2.75rem]">
                “{lead.body}”
              </blockquote>
              <figcaption className="mt-6 text-ink-muted">
                {lead.author} · {t.home.reviewSource}
              </figcaption>
            </figure>
          </Reveal>
          <div className="mt-20 grid gap-8 lg:grid-cols-12 lg:gap-16">
            <div className="gap-x-14 sm:columns-2 lg:col-span-8 lg:col-start-5">
              {otherReviews.map((r, i) => (
                <Reveal as="figure" key={r.author} delay={(i % 2) * 120} className="mb-12 break-inside-avoid">
                  <blockquote lang="en" className="font-display text-xl leading-snug text-ink">
                    “{r.body}”
                  </blockquote>
                  <figcaption className="mt-3 text-sm text-ink-muted">{r.author}</figcaption>
                </Reveal>
              ))}
              <QuietLink href={mapsSearchUrl(SITE.mapQuery)} external>
                {t.home.reviewsCta}
              </QuietLink>
            </div>
          </div>
        </Container>
      </section>

      {/* 5. The way to a reservation: green panel with the photo cut on a diagonal */}
      <section className="grain grain-dark relative isolate overflow-hidden bg-pine-700 text-cream-100">
        <div className="relative -z-10 aspect-[4/3] [clip-path:polygon(0_0,100%_0,100%_78%,0_100%)] sm:aspect-[16/9] lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[50%] lg:[clip-path:polygon(24%_0,100%_0,100%_100%,0_100%)]">
          <Image src={PHOTOS.brickRoom.src} alt={t.photos.brickRoom.alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        </div>
        <Container className="py-24 lg:py-32">
          <Reveal className="lg:max-w-[42%]">
            <h2 className="display text-4xl text-cream-50 sm:text-5xl">{t.home.howTitle}</h2>
            <p className="mt-6 max-w-md leading-relaxed text-cream-100/75">{t.home.howBody}</p>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Button asChild size="lg" variant="mustard">
                <Link href="/reserve">{t.nav.reserve}</Link>
              </Button>
              <a href={`tel:${SITE.phones[0].tel}`} className="text-cream-100/80 transition-colors hover:text-cream-100">
                {SITE.phones[0].display}
              </a>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
