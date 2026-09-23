"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Star } from "lucide-react";
import { updateMenuItem } from "@/actions/admin";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import type { MenuCategory, MenuItem } from "@/lib/types";

export function MenuManager({ menu }: { menu: MenuCategory[] }) {
  const [query, setQuery] = useState("");
  const [onlyOut, setOnlyOut] = useState(false);
  const q = query.trim().toLowerCase();
  const outCount = menu.reduce((s, c) => s + c.menu_items.filter((i) => !i.is_available).length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <Input placeholder="Search dishes…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-10 pl-9 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input type="checkbox" checked={onlyOut} onChange={(e) => setOnlyOut(e.target.checked)} />
          Only 86&apos;d ({outCount})
        </label>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {menu.map((cat) => {
          const items = cat.menu_items.filter((i) => (!q || i.name_en.toLowerCase().includes(q) || i.name_bn.includes(q)) && (!onlyOut || !i.is_available));
          if (!items.length) return null;
          return (
            <section key={cat.id} className="rounded-sm border border-line bg-surface">
              <h2 className="border-b border-line px-4 py-3 font-display text-xl text-ink">
                {cat.name_en} <span className="text-sm text-ink-muted">· {cat.name_bn}</span>
              </h2>
              <ul className="divide-y divide-line">
                {items.map((item) => (
                  <MenuItemRow key={item.id} item={item} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MenuItemRow({ item }: { item: MenuItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [price, setPrice] = useState(String(item.price));

  const save = (patch: Parameters<typeof updateMenuItem>[1], msg: string) =>
    start(async () => {
      const res = await updateMenuItem(item.id, patch);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(msg);
        router.refresh();
      }
    });

  return (
    <li className={cn("flex flex-wrap items-center gap-3 px-4 py-3 text-sm", !item.is_available && "bg-red-50/50")}>
      <div className="min-w-0 flex-1">
        <p className={cn("font-semibold text-ink", !item.is_available && "text-ink-muted line-through")}>{item.name_en}</p>
        <p className="text-xs text-ink-muted">
          {item.name_bn}
          {item.menu_item_variants.length > 1 ? ` · ${item.menu_item_variants.length} options` : ""}
          {item.menu_item_addons.length ? ` · ${item.menu_item_addons.length} add-ons` : ""}
        </p>
      </div>
      <button
        type="button"
        aria-pressed={item.is_featured}
        aria-label="Featured on home page"
        title="Featured on home page"
        disabled={pending}
        onClick={() => save({ is_featured: !item.is_featured }, item.is_featured ? "Removed from signatures" : "Featured on home page")}
        className={cn("rounded-full p-1.5", item.is_featured ? "text-gold-600" : "text-ink-muted/40 hover:text-ink-muted")}
      >
        <Star className="size-4" fill={item.is_featured ? "currentColor" : "none"} />
      </button>
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          save({ price: Number(price) }, "Price updated");
        }}
      >
        <span className="text-ink-muted">৳</span>
        <Input
          type="number"
          min={0}
          step={1}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => Number(price) !== Number(item.price) && save({ price: Number(price) }, "Price updated")}
          className="h-8 w-20 px-2 text-sm"
          aria-label={`${item.name_en} price`}
        />
      </form>
      <label className="inline-flex cursor-pointer items-center gap-2">
        <span className="sr-only">Available</span>
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={item.is_available}
          disabled={pending}
          onChange={(e) => save({ is_available: e.target.checked }, e.target.checked ? `${item.name_en} back on` : `${item.name_en} 86'd`)}
        />
        <span className="relative h-5 w-9 rounded-full bg-line transition-colors peer-checked:bg-forest-600 peer-focus-visible:ring-2 peer-focus-visible:ring-accent after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
        <span className="w-16 text-xs text-ink-muted">{item.is_available ? "Available" : "86'd"}</span>
      </label>
    </li>
  );
}
