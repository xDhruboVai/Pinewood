import { Sacramento, Young_Serif } from "next/font/google";
import { HeroCarousel, type HeroSlideView } from "@/components/site/hero-carousel";
import { pick } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/en";
import { formatPrice, formatTime } from "@/lib/format";
import { PHOTOS, type PhotoName } from "@/lib/site";
import type { Locale, MenuCategory, ScheduleDay } from "@/lib/types";

type Text = { en: string; bn: string };

// The hero's own fonts: a sturdy, friendly serif for the dish name and price (Young Serif, chosen by
// Saalim on 26 September 2026 in place of Playfair Display), and a thin handwritten script for the
// accent lines. Declared here rather than in the root layout so only the home page downloads them.
const youngSerif = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--font-hero-serif", display: "swap" });
const sacramento = Sacramento({ subsets: ["latin"], weight: "400", variable: "--font-sacramento", display: "swap" });

/**
 * Dishes shown in the home hero, in order. `slug` is the dish's slug in the menu data; its name,
 * description, price and section come from there, so a slide is skipped if the dish isn't on the menu.
 * A dish that Pinewood posts about but that isn't in the menu data yet has `custom` text instead
 * (taken from their own post, no price) and `section`, the menu section slug it belongs to.
 * `position` is the CSS object-position that keeps the plate in view.
 * Photos from Pinewood's Facebook posts, 25 September 2026 (see CLAUDE.md).
 */
const HERO_SLIDES: { slug: string; photo: PhotoName; position: string; custom?: { name: Text; description: Text }; section?: string }[] = [
  // Only real photos at 1000px wide or more, on dark wood or dark backgrounds that melt into the
  // green (white-plate shots like Pine 2, the brownie and the Oreo cheesecake looked out of place).
  // The hero is full screen, so smaller images look blurred
  // (the crops from Pinewood's Facebook posters were tried here and taken out, 25 September 2026).
  { slug: "pine-3", photo: "hero", position: "80% 50%" },
  { slug: "seafood-platter", photo: "seafoodPlatter", position: "70% 50%" },
  { slug: "american-mac-cheese", photo: "macAndCheese", position: "70% 60%" },
];

/**
 * Home page hero in the style of the printed menu: a dish photo fading into the green, a script
 * accent line, the dish name as a large serif title, and its price in mustard. Slides left and right
 * between the dishes above. Falls back to the site name when none of them are on the menu.
 */
export function HomeHero({ locale, t, menu, today }: { locale: Locale; t: Dictionary; menu: MenuCategory[]; today?: ScheduleDay }) {
  const slides: HeroSlideView[] = HERO_SLIDES.flatMap(({ slug, photo, position, custom, section }) => {
    if (custom) {
      const category = menu.find((c) => c.slug === section);
      return [
        {
          key: slug,
          name: custom.name[locale],
          description: custom.description[locale],
          price: "",
          section: category ? pick(category, "name", locale) : "",
          src: PHOTOS[photo].src,
          alt: t.photos[photo].alt,
          position,
        },
      ];
    }
    const category = menu.find((c) => c.menu_items.some((i) => i.slug === slug));
    const item = category?.menu_items.find((i) => i.slug === slug);
    if (!category || !item) return [];
    return [
      {
        key: slug,
        name: pick(item, "name", locale),
        description: pick(item, "description", locale),
        price: formatPrice(item.price, locale),
        section: pick(category, "name", locale),
        src: PHOTOS[photo].src,
        alt: t.photos[photo].alt,
        position,
      },
    ];
  });

  if (slides.length === 0) {
    slides.push({
      key: "pinewood",
      name: t.home.titleA,
      description: t.home.titleB,
      price: "",
      section: "",
      src: PHOTOS.hero.src,
      alt: t.photos.hero.alt,
      position: "80% 50%",
    });
  }

  return (
    <HeroCarousel
      fontClassName={`${youngSerif.variable} ${sacramento.variable}`}
      slides={slides}
      bn={locale === "bn"}
      labels={{
        title: `${t.home.titleA} ${t.home.titleB}`,
        accent: t.home.heroAccent,
        eyebrow: t.home.eyebrow,
        note: today?.opens && today.closes ? t.home.heroOpenUntil(formatTime(today.closes, locale)) : t.common.closedToday,
        reserve: t.nav.reserve,
        menu: t.nav.menu,
      }}
    />
  );
}
