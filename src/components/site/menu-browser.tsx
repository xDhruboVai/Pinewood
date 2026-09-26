"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n, pickClient } from "@/lib/i18n/client";
import { formatPrice } from "@/lib/format";
import { PHOTOS, type PhotoName } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { Branch, MenuCategory, MenuItem, MenuSection, MenuTag } from "@/lib/types";

const FILTERS: (MenuTag | "all")[] = ["all", "halal", "vegetarian", "chef_special"];
const SECTIONS: MenuSection[] = ["starters", "mains", "coffee", "desserts", "beverages"];
const TAG_ORDER: MenuTag[] = ["chef_special", "halal", "vegetarian", "spicy", "seafood", "contains_nuts"];

// Photos shown among each section's dishes. "soft" fades the edges of crops cut from the printed menu.
const SECTION_PHOTOS: Partial<Record<MenuSection, { name: PhotoName; soft?: boolean }[]>> = {
  starters: [{ name: "fishCake" }, { name: "soup" }, { name: "potatoWedges" }],
  mains: [
    { name: "hero" },
    { name: "steakSet" },
    { name: "pine2" },
    { name: "buffaloChickenSet" },
    { name: "seafoodPlatter" },
    { name: "mexicanChicken" },
    { name: "shashlikSet" },
    { name: "chickenCheeseBurger" },
    { name: "chickenPlate" },
    { name: "clubSandwich" },
    { name: "alfredoBake" },
    { name: "penne" },
  ],
  coffee: [{ name: "coffeeCup" }, { name: "cappuccino", soft: true }],
  desserts: [{ name: "oreoCheesecakeReal" }, { name: "brownieReal" }, { name: "redVelvet", soft: true }],
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
        .map((c) => ({ ...c, menu_items: c.menu_items.filter(match) }))
        .filter((c) => c.menu_items.length > 0),
    })).filter((s) => s.categories.length > 0);
  }, [menu, filter]);

  return (
    <div className="grain grain-dark bg-pine-700 text-cream-100">
      <div className="sticky top-20 z-30 bg-pine-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3.5 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <nav aria-label={t.nav.menu} className="no-scrollbar -mx-5 flex gap-7 overflow-x-auto px-5 md:mx-0 md:px-0">
            {grouped.map(({ section }) => (
              <a key={section} href={`#section-${section}`} className="label shrink-0 text-cream-100/75 hover:text-mustard-400">
                {t.menu.sections[section]}
              </a>
            ))}
          </nav>
          <div role="group" aria-label={t.menu.filterLabel} className="no-scrollbar -mx-5 flex gap-5 overflow-x-auto px-5 text-[0.8rem] md:mx-0 md:px-0">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
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
          <section key={section} id={`section-${section}`} className="scroll-mt-36 py-12 sm:py-16">
            {/* The section (Starters, Mains...) heads its categories: h1 page title > h2 section > h3 category. */}
            <h2 className="label mb-6 text-mustard-400">{t.menu.sections[section]}</h2>
            <div className="gap-16 md:columns-2">
              {categories.map((cat) => (
                <div key={cat.id} className="mb-12 break-inside-avoid">
                  <h3 className="script pl-1 text-4xl text-cream-100 lowercase sm:text-5xl">{pickClient(cat, "name", locale)}</h3>
                  <ul className="mt-4 space-y-4">
                    {cat.menu_items.map((item) => (
                      <MenuRow key={item.id} item={item} branchMenus={resolvedBranchMenus} />
                    ))}
                  </ul>
                </div>
              ))}
              {(SECTION_PHOTOS[section] ?? []).map(({ name, soft }) => (
                <figure key={name} className="mb-12 break-inside-avoid">
                  <Image
                    src={PHOTOS[name].src}
                    alt={t.photos[name].alt}
                    width={PHOTOS[name].width}
                    height={PHOTOS[name].height}
                    sizes="(min-width: 768px) 40vw, 100vw"
                    className={cn("w-full", soft ? "soft-edges h-auto" : "aspect-[4/3] rounded-md object-cover")}
                  />
                  {t.photos[name].caption ? <figcaption className="label mt-3 text-cream-100/60">{t.photos[name].caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          </section>
        ))}

      </div>
    </div>
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
