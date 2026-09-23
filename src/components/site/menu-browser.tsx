"use client";

import { useMemo, useState } from "react";
import { Container } from "./section";
import { TagBadges } from "./tag-badges";
import { Badge } from "@/components/ui/badge";
import { useI18n, pickClient } from "@/lib/i18n/client";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MenuCategory, MenuItem, MenuSection, MenuTag } from "@/lib/types";

const FILTERS: (MenuTag | "all")[] = ["all", "halal", "vegetarian", "chef_special"];
const SECTIONS: MenuSection[] = ["starters", "mains", "coffee", "desserts", "beverages"];

export function MenuBrowser({ menu }: { menu: MenuCategory[] }) {
  const { locale, t } = useI18n();
  const [filter, setFilter] = useState<MenuTag | "all">("all");

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
    <>
      <div className="sticky top-18 z-30 border-b border-line bg-canvas/90 backdrop-blur-md">
        <Container className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
          <nav aria-label={t.nav.menu} className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
            {grouped.map(({ section }) => (
              <a
                key={section}
                href={`#section-${section}`}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                {t.menu.sections[section]}
              </a>
            ))}
          </nav>
          <div role="group" aria-label={t.menu.filterLabel} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  filter === f ? "border-primary bg-primary text-primary-ink" : "border-line text-ink-muted hover:border-ink/40 hover:text-ink",
                )}
              >
                {f === "all" ? t.menu.filterAll : t.menu.tags[f]}
              </button>
            ))}
          </div>
        </Container>
      </div>

      <Container className="py-14 lg:py-20">
        {grouped.length === 0 ? <p className="py-20 text-center text-ink-muted">{t.menu.empty}</p> : null}

        {grouped.map(({ section, categories }) => (
          <section key={section} id={`section-${section}`} className="scroll-mt-40 border-b border-line pb-16 not-first:pt-16 last:border-b-0">
            <h2 className="display text-5xl text-ink sm:text-6xl">{t.menu.sections[section]}</h2>
            <div className="mt-10 space-y-14">
              {categories.map((cat) => (
                <div key={cat.id}>
                  <h3 className="eyebrow">{pickClient(cat, "name", locale)}</h3>
                  <ul className="mt-5 grid gap-x-14 lg:grid-cols-2">
                    {cat.menu_items.map((item) => (
                      <MenuRow key={item.id} item={item} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}

        <p className="mt-10 text-center text-sm text-ink-muted">{t.menu.preorderNote}</p>
      </Container>
    </>
  );
}

function MenuRow({ item }: { item: MenuItem }) {
  const { locale, t } = useI18n();
  const description = pickClient(item, "description", locale);

  return (
    <li className={cn("border-b border-line py-5", !item.is_available && "opacity-55")}>
      <div className="flex items-baseline gap-3">
        <h4 className="font-display text-[1.35rem] leading-tight text-ink">{pickClient(item, "name", locale)}</h4>
        <span className="h-px min-w-6 flex-1 -translate-y-1 border-b border-dotted border-ink/25" aria-hidden />
        <span className={cn("font-display text-lg text-ink", !item.is_available && "line-through")}>{formatPrice(item.price, locale)}</span>
      </div>
      {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      {item.menu_item_variants.length > 1 ? (
        <p className="mt-1.5 text-xs text-ink-muted">
          <span className="font-semibold">{t.menu.options}:</span>{" "}
          {item.menu_item_variants
            .map((v) => pickClient(v, "name", locale) + (Number(v.price_delta) > 0 ? ` (+${formatPrice(Number(v.price_delta), locale)})` : ""))
            .join(" · ")}
        </p>
      ) : null}
      {item.menu_item_addons.length > 0 ? (
        <p className="mt-1 text-xs text-ink-muted">
          <span className="font-semibold">{t.menu.addons}:</span>{" "}
          {item.menu_item_addons.map((a) => `${pickClient(a, "name", locale)} +${formatPrice(Number(a.price), locale)}`).join(" · ")}
        </p>
      ) : null}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {!item.is_available ? <Badge tone="neutral">{t.menu.unavailable}</Badge> : null}
        <TagBadges tags={item.tags} t={t} className="contents" />
      </div>
    </li>
  );
}
