"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { useI18n, pickClient } from "@/lib/i18n/client";
import { formatPrice } from "@/lib/format";
import { DISH_PHOTOS, PHOTOS, type PhotoName } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { Branch, MenuCategory, MenuItem, MenuSection, MenuTag } from "@/lib/types";

const FILTERS: (MenuTag | "all")[] = ["all", "halal", "vegetarian", "chef_special"];
const SECTIONS: MenuSection[] = ["starters", "mains", "coffee", "desserts", "beverages"];
const TAG_ORDER: MenuTag[] = ["chef_special", "halal", "vegetarian", "spicy", "seafood", "contains_nuts"];
// Which dish each photo shows, where it shows one (the reverse of DISH_PHOTOS).
const PHOTO_DISH = new Map(Object.entries(DISH_PHOTOS).map(([slug, photo]) => [photo as PhotoName, slug]));

// The photos that go beside each category (by category slug), best first. A category's photos sit
// only beside its own list, never under it or beside another category's.
const CATEGORY_PHOTOS: Record<string, PhotoName[]> = {
  "finger-foods": ["fishCake", "potatoWedges"],
  soup: ["soup"],
  "chicken-specials": ["buffaloChickenSet", "mexicanChicken", "chickenPlate"],
  "pine-sets": ["hero", "shashlikSet", "pine2", "steakSet"],
  "seafood-sets": ["seafoodPlatterPost"],
  pasta: ["alfredoBake", "penne", "spaghetti"],
  burgers: ["chickenCheeseBurger"],
  sandwiches: ["clubSandwich"],
  coffee: ["cappuccinoPost", "coffeeCup"],
  desserts: ["oreoCheesecakeReal", "brownieReal"],
  freezers: ["lemonade"],
};

type BranchMenuView = { branch: Branch; items: Map<string, MenuItem> };

export function MenuBrowser({ menu, branchMenus }: { menu: MenuCategory[]; branchMenus: { branch: Branch; menu: MenuCategory[] }[] }) {
  const { locale, t } = useI18n();
  const [filter, setFilter] = useState<MenuTag | "all">("all");
  const resolvedBranchMenus: BranchMenuView[] = useMemo(
    () => branchMenus.map(({ branch, menu: branchMenu }) => ({
      branch,
      items: new Map(branchMenu.flatMap((category) => category.menu_items.map((item) => [item.id, item] as const))),
    })),
    [branchMenus],
  );

  const grouped = useMemo(() => {
    const match = (i: MenuItem) => filter === "all" || i.tags.includes(filter);
    return SECTIONS.map((section) => ({
      section,
      categories: menu
        .filter((c) => c.section === section)
        .map((c) => {
          const items = c.menu_items.filter(match);
          // With a filter on, a photo stays only if it can't mislead: its own dish is still listed, or
          // it shows no particular dish and every dish in the category passes the filter. So
          // Vegetarian never shows the fish cake.
          const shown = new Set(items.map((i) => i.slug));
          const everyDishPasses = c.menu_items.every(match);
          const photos = (CATEGORY_PHOTOS[c.slug] ?? []).filter((name) => {
            if (filter === "all") return true;
            const dish = PHOTO_DISH.get(name);
            return dish ? shown.has(dish) : everyDishPasses;
          });
          return { ...c, menu_items: items, photos };
        })
        .filter((c) => c.menu_items.length > 0),
    })).filter((s) => s.categories.length > 0);
  }, [menu, filter]);

  // Changing the filter, or picking a section, brings the list into view from its top, instead of
  // leaving the reader somewhere in the middle of a list that just changed under them.
  const listTop = useRef<HTMLDivElement>(null);
  const scrollBehavior = (): ScrollBehavior => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
  const chooseFilter = (f: MenuTag | "all") => {
    setFilter(f);
    const el = listTop.current;
    if (!el) return;
    // The site header (80px) stays on screen, so stop just under it.
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    if (window.scrollY > top) window.scrollTo({ top, behavior: scrollBehavior() });
  };
  const goToSection = (e: React.MouseEvent<HTMLAnchorElement>, section: MenuSection) => {
    const el = document.getElementById(`section-${section}`);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    history.replaceState(null, "", `#section-${section}`);
  };

  return (
    <div ref={listTop} className="grain grain-dark bg-pine-700 text-cream-100">
      <div className="sticky top-20 z-30 bg-pine-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3.5 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <nav aria-label={t.nav.menu} className="no-scrollbar -mx-5 flex gap-7 overflow-x-auto px-5 md:mx-0 md:px-0">
            {grouped.map(({ section }) => (
              <a key={section} href={`#section-${section}`} onClick={(e) => goToSection(e, section)} className="label shrink-0 text-cream-100/75 hover:text-mustard-400">
                {t.menu.sections[section]}
              </a>
            ))}
          </nav>
          <div role="group" aria-label={t.menu.filterLabel} className="no-scrollbar -mx-5 flex gap-5 overflow-x-auto px-5 text-[0.8rem] md:mx-0 md:px-0">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => chooseFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  "shrink-0 font-medium transition-colors",
                  filter === f ? "text-mustard-400" : "text-cream-100/60 hover:text-cream-100",
                )}
              >
                {f === "all" ? t.menu.filterAll : t.menu.tags[f]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        {grouped.length === 0 ? <p className="py-24 text-center text-cream-100/70">{t.menu.empty}</p> : null}

        {grouped.map(({ section, categories }) => (
          <section key={section} id={`section-${section}`} className="scroll-mt-36 py-9 sm:py-11">
            {/* The section (Starters, Mains...) heads its categories: h1 page title > h2 section > h3 category. */}
            <h2 className="label mb-5 text-mustard-400">{t.menu.sections[section]}</h2>
            <div className="space-y-12">
              {categories.map((cat) => (
                <CategoryBlock key={cat.id} name={pickClient(cat, "name", locale)} photos={cat.photos}>
                  {cat.menu_items.map((item) => (
                    <MenuRow key={item.id} item={item} branchMenus={resolvedBranchMenus} />
                  ))}
                </CategoryBlock>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * One category: its dishes on the left and its own photos on the right, sized to the list so neither
 * side runs on into empty space.
 * - No photo: the list runs across both columns.
 * - A long list with one photo (Beverages): the list in two columns, the photo in a third.
 * - Otherwise two columns: one photo (wider and shorter beside a short list), or two side by side
 *   (stacked for a long list), plus a third underneath once the list is long enough.
 */
function CategoryBlock({ name, photos, children }: { name: string; photos: PhotoName[]; children: React.ReactNode[] }) {
  const n = children.length;
  const title = <h3 className="script pl-1 text-4xl text-cream-100 lowercase sm:text-5xl">{name}</h3>;
  const splitList = "gap-16 md:columns-2 [&>li]:mb-4 [&>li]:break-inside-avoid";

  if (photos.length === 0) {
    return (
      <div>
        {title}
        <ul className={cn("mt-4", n > 1 ? cn(splitList, "-mb-4") : "")}>{children}</ul>
      </div>
    );
  }

  if (n >= 10 && photos.length === 1) {
    return (
      <div className="grid gap-x-16 gap-y-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {title}
          <ul className={cn("mt-4 -mb-4", splitList)}>{children}</ul>
        </div>
        <MenuPhoto name={photos[0]} aspect="aspect-[4/5]" sizes="(min-width: 1024px) 25vw, (min-width: 768px) 28rem, 100vw" className="max-w-md lg:max-w-none" />
      </div>
    );
  }

  // Six or more dishes take a third photo under the pair; seven or more with only two photos stack
  // them, wide, one above the other, which matches a long list's height better than a pair.
  const count = photos.length >= 2 && n >= 3 ? (n >= 6 && photos.length >= 3 ? 3 : 2) : 1;
  const [first, second, third] = photos.slice(0, count);
  const stacked = count === 2 && n >= 7;
  return (
    <div className="grid items-start gap-x-16 gap-y-6 md:grid-cols-2">
      <div>
        {title}
        <ul className="mt-4 space-y-4">{children}</ul>
      </div>
      <div className="space-y-4">
        {stacked ? (
          <>
            <MenuPhoto name={first} aspect="aspect-[16/9]" />
            <MenuPhoto name={second} aspect="aspect-[16/9]" />
          </>
        ) : second ? (
          <div className="grid grid-cols-2 gap-4">
            <MenuPhoto name={first} aspect="aspect-[4/5]" sizes="(min-width: 768px) 20vw, 50vw" />
            <MenuPhoto name={second} aspect="aspect-[4/5]" sizes="(min-width: 768px) 20vw, 50vw" />
          </div>
        ) : (
          <MenuPhoto name={first} aspect={n <= 3 ? "aspect-[16/9]" : "aspect-[4/3]"} />
        )}
        {/* The third photo only on wider screens, where it sits beside the list; on phones it would just
            make the page longer. */}
        {third ? <MenuPhoto name={third} aspect="aspect-[16/9]" className="hidden md:block" /> : null}
      </div>
    </div>
  );
}

function MenuPhoto({
  name,
  aspect = "aspect-[4/3]",
  className,
  sizes = "(min-width: 768px) 40vw, 100vw",
}: {
  name: PhotoName;
  aspect?: string;
  className?: string;
  sizes?: string;
}) {
  const { t } = useI18n();
  return (
    <figure className={className}>
      <Image
        src={PHOTOS[name].src}
        alt={t.photos[name].alt}
        width={PHOTOS[name].width}
        height={PHOTOS[name].height}
        sizes={sizes}
        className={cn("w-full rounded-md object-cover", aspect)}
      />
      {t.photos[name].caption ? <figcaption className="label mt-3 text-cream-100/60">{t.photos[name].caption}</figcaption> : null}
    </figure>
  );
}

function MenuRow({ item, branchMenus }: { item: MenuItem; branchMenus: BranchMenuView[] }) {
  const { locale, t } = useI18n();
  const description = pickClient(item, "description", locale);
  const branchPrices = branchMenus.map(({ branch, items }) => {
    const branchItem = items.get(item.id);
    return {
      branch,
      price: Number(branchItem?.price ?? item.price),
      available: branchItem?.is_available ?? item.is_available,
    };
  });
  const pricesDiffer = new Set(branchPrices.map(({ price }) => price)).size > 1;
  const unavailableBranches = branchPrices
    .filter(({ available }) => !available)
    .map(({ branch }) => locale === "bn" ? branch.name_bn : branch.name_en);
  const unavailableEverywhere = branchPrices.length > 0
    ? unavailableBranches.length === branchPrices.length
    : !item.is_available;
  const options = item.menu_item_variants.length > 1
    ? item.menu_item_variants
        .map((v) => pickClient(v, "name", locale) + (Number(v.price_delta) > 0 ? ` +${formatPrice(Number(v.price_delta), locale)}` : ""))
        .join(" / ")
    : "";
  const addons = item.menu_item_addons.map((a) => `${pickClient(a, "name", locale)} +${formatPrice(Number(a.price), locale)}`).join(" / ");
  const tags = TAG_ORDER.filter((tag) => item.tags.includes(tag)).map((tag) => t.menu.tags[tag]);
  const availabilityNote = unavailableBranches.length > 0
    ? `${t.menu.unavailableAt} ${unavailableBranches.join(", ")}`
    : branchPrices.length === 0 && !item.is_available
      ? t.menu.unavailable
      : null;

  return (
    <li className={cn("grid grid-cols-[1fr_auto] items-baseline gap-x-3", unavailableEverywhere && "opacity-45")}>
      <span className="text-[0.95rem] font-semibold tracking-[0.03em] text-cream-100 uppercase">{pickClient(item, "name", locale)}</span>
      {pricesDiffer ? (
        <dl className="col-span-2 mt-1 space-y-1 border-l-2 border-mustard-400/55 pl-3">
          {branchPrices.map(({ branch, price }) => (
            <div key={branch.id} className="flex min-w-0 items-baseline justify-between gap-4 border-t border-cream-100/10 pt-1 first:border-0 first:pt-0">
              <dt className="min-w-0 break-words text-xs leading-relaxed text-cream-100/70">
                {locale === "bn" ? branch.name_bn : branch.name_en}
              </dt>
              <dd className="shrink-0 text-sm font-semibold tabular-nums text-cream-100">{formatPrice(price, locale)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <span className={cn("text-[0.95rem] font-semibold tabular-nums text-cream-100", unavailableEverywhere && "line-through")}>
          {formatPrice(branchPrices[0]?.price ?? item.price, locale)}
        </span>
      )}
      {options ? <span className="col-span-2 text-[0.8rem] font-medium text-mustard-300 lowercase">({options})</span> : null}
      {description ? <span className="col-span-2 mt-0.5 text-sm leading-relaxed text-cream-100/65">{description}</span> : null}
      {addons ? (
        <span className="col-span-2 mt-0.5 text-[0.8rem] text-cream-100/65">
          {t.menu.addons}: {addons}
        </span>
      ) : null}
      {tags.length || availabilityNote ? (
        <span className="label col-span-2 mt-1 !text-[0.62rem] text-mustard-400/80">
          {[availabilityNote, ...tags].filter(Boolean).join(" · ")}
        </span>
      ) : null}
    </li>
  );
}
