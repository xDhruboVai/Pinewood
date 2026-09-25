"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search } from "lucide-react";
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
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.5} />
          <Input placeholder="Search dishes" value={query} onChange={(e) => setQuery(e.target.value)} className="h-10 pl-9 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input type="checkbox" checked={onlyOut} onChange={(e) => setOnlyOut(e.target.checked)} className="accent-[var(--primary)]" />
          Only dishes that are off ({outCount})
        </label>
      </div>

      <div className="grid gap-x-16 gap-y-14 xl:grid-cols-2">
        {menu.map((cat) => {
          const items = cat.menu_items.filter((i) => (!q || i.name_en.toLowerCase().includes(q) || i.name_bn.includes(q)) && (!onlyOut || !i.is_available));
          if (!items.length) return null;
          return (
            <section key={cat.id}>
              <h2 className="flex flex-wrap items-baseline gap-x-3">
                <span className="script pl-1 text-4xl text-ink lowercase">{cat.name_en}</span>
                <span className="text-sm text-ink-muted">{cat.name_bn}</span>
              </h2>
              <ul className="mt-4 space-y-1">
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
    <li className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md px-3 py-2.5 text-sm", item.is_available ? "hover:bg-surface" : "bg-red-50")}>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[0.82rem] font-semibold tracking-wide text-ink uppercase", !item.is_available && "text-ink-muted line-through")}>{item.name_en}</p>
        <p className="text-xs text-ink-muted">
          {item.name_bn}
          {item.menu_item_variants.length > 1 ? ` · ${item.menu_item_variants.length} options` : ""}
          {item.menu_item_addons.length ? ` · ${item.menu_item_addons.length} add-ons` : ""}
        </p>
      </div>
      <button
        type="button"
        aria-pressed={item.is_featured}
        title="Show this dish on the home page"
        disabled={pending}
        onClick={() => save({ is_featured: !item.is_featured }, item.is_featured ? "Taken off the home page" : "Now on the home page")}
        className={cn("w-24 text-left text-xs transition-colors", item.is_featured ? "font-medium text-accent-ink" : "text-ink-muted/70 hover:text-ink")}
      >
        {item.is_featured ? "On home page" : "Add to home"}
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
          className="h-8 w-20 bg-transparent px-2 text-sm"
          aria-label={`${item.name_en} price`}
        />
      </form>
      <button
        type="button"
        role="switch"
        aria-checked={item.is_available}
        aria-label={`${item.name_en} available`}
        disabled={pending}
        onClick={() => save({ is_available: !item.is_available }, item.is_available ? `${item.name_en} is off the menu for now` : `${item.name_en} is back on`)}
        className="w-24 text-right text-xs"
      >
        {item.is_available ? (
          <span className="text-ink-muted hover:text-danger">Available</span>
        ) : (
          <span className="font-semibold text-danger hover:text-ink">Off · put back</span>
        )}
      </button>
    </li>
  );
}
