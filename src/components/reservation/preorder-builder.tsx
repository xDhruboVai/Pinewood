"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Minus, Plus, Trash2 } from "lucide-react";
import { savePreOrder } from "@/actions/preorder";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Textarea } from "@/components/ui/form";
import { TagBadges } from "@/components/site/tag-badges";
import { useI18n, pickClient } from "@/lib/i18n/client";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MenuCategory, MenuItem, MenuSection } from "@/lib/types";

export interface CartLine {
  itemId: string;
  variantId: string | null;
  addonIds: string[];
  quantity: number;
  notes: string;
}

const lineKey = (l: Pick<CartLine, "itemId" | "variantId" | "addonIds">) =>
  `${l.itemId}|${l.variantId ?? ""}|${[...l.addonIds].sort().join(",")}`;

export function PreOrderBuilder({
  token,
  menu,
  initialLines,
  initialNotes,
}: {
  token: string;
  menu: MenuCategory[];
  initialLines: CartLine[];
  initialNotes: string;
}) {
  const { locale, t } = useI18n();
  const items = useMemo(() => new Map(menu.flatMap((c) => c.menu_items.map((i) => [i.id, i] as const))), [menu]);
  const sections = useMemo(
    () => (["starters", "mains", "coffee", "desserts", "beverages"] as MenuSection[]).filter((s) => menu.some((c) => c.section === s)),
    [menu],
  );
  const [section, setSection] = useState<MenuSection>(sections.includes("mains") ? "mains" : (sections[0] ?? "mains"));
  const [lines, setLines] = useState<CartLine[]>(() => initialLines.filter((l) => items.get(l.itemId)?.is_available));
  const [notes, setNotes] = useState(initialNotes);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [dirty, setDirty] = useState(false);

  const unitPrice = (l: CartLine) => {
    const item = items.get(l.itemId);
    if (!item) return 0;
    const variant = item.menu_item_variants.find((v) => v.id === l.variantId);
    const addons = item.menu_item_addons.filter((a) => l.addonIds.includes(a.id));
    return Number(item.price) + Number(variant?.price_delta ?? 0) + addons.reduce((s, a) => s + Number(a.price), 0);
  };
  const total = lines.reduce((s, l) => s + unitPrice(l) * l.quantity, 0);

  const addLine = (line: CartLine) => {
    setDirty(true);
    setLines((prev) => {
      const key = lineKey(line);
      const existing = prev.find((l) => lineKey(l) === key);
      if (existing) return prev.map((l) => (l === existing ? { ...l, quantity: Math.min(20, l.quantity + line.quantity) } : l));
      return prev.length >= 40 ? prev : [...prev, line];
    });
  };
  const updateLine = (index: number, patch: Partial<CartLine>) => {
    setDirty(true);
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };
  const removeLine = (index: number) => {
    setDirty(true);
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const save = (clear = false) => {
    startSaving(async () => {
      const res = await savePreOrder({
        token,
        notes: clear ? "" : notes,
        items: clear
          ? []
          : lines.map((l) => ({ item_id: l.itemId, variant_id: l.variantId, addon_ids: l.addonIds, quantity: l.quantity, notes: l.notes })),
      });
      if (!res.ok) {
        toast.error(t.errors[res.error] ?? t.errors.generic);
        return;
      }
      if (clear) {
        setLines([]);
        setNotes("");
      }
      setDirty(false);
      toast.success(t.manage.saved);
    });
  };

  const categories = menu.filter((c) => c.section === section);

  return (
    <div className="mt-10 grid gap-10 xl:grid-cols-[1fr_320px]">
      <div>
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
          {sections.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={s === section}
              onClick={() => setSection(s)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors",
                s === section ? "border-primary bg-primary text-primary-ink" : "border-line text-ink-muted hover:text-ink",
              )}
            >
              {t.menu.sections[s]}
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-10" role="tabpanel">
          {categories.map((cat) => (
            <div key={cat.id}>
              <h3 className="eyebrow">{pickClient(cat, "name", locale)}</h3>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {cat.menu_items.map((item) => (
                  <li key={item.id} className={cn("py-4", !item.is_available && "opacity-50")}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-display text-lg leading-tight text-ink">{pickClient(item, "name", locale)}</p>
                        {pickClient(item, "description", locale) ? (
                          <p className="mt-0.5 text-xs text-ink-muted">{pickClient(item, "description", locale)}</p>
                        ) : null}
                        <TagBadges tags={item.tags.filter((tg) => tg !== "halal")} t={t} className="mt-2 flex flex-wrap gap-1" />
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm text-ink">{formatPrice(Number(item.price), locale)}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant={configuring === item.id ? "subtle" : "outline"}
                          disabled={!item.is_available}
                          onClick={() => {
                            const needsConfig = item.menu_item_variants.length > 1 || item.menu_item_addons.length > 0;
                            if (needsConfig) {
                              setConfiguring((c) => (c === item.id ? null : item.id));
                            } else {
                              addLine({
                                itemId: item.id,
                                variantId: item.menu_item_variants[0]?.id ?? null,
                                addonIds: [],
                                quantity: 1,
                                notes: "",
                              });
                              toast.success(`${pickClient(item, "name", locale)} · ${t.manage.added}`);
                            }
                          }}
                        >
                          {item.is_available ? (
                            <>
                              <Plus /> {t.manage.add}
                            </>
                          ) : (
                            t.menu.unavailable
                          )}
                        </Button>
                      </div>
                    </div>
                    {configuring === item.id ? (
                      <Configurator
                        item={item}
                        onAdd={(line) => {
                          addLine(line);
                          setConfiguring(null);
                          toast.success(`${pickClient(item, "name", locale)} · ${t.manage.added}`);
                        }}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <div className="rounded-sm border border-line bg-surface p-5">
          <p className="eyebrow">{t.manage.yourOrder}</p>
          {lines.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">{t.manage.emptyOrder}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {lines.map((l, index) => {
                const item = items.get(l.itemId);
                if (!item) return null;
                const variant = item.menu_item_variants.find((v) => v.id === l.variantId);
                const addons = item.menu_item_addons.filter((a) => l.addonIds.includes(a.id));
                return (
                  <li key={lineKey(l)} className="py-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-ink">
                        {pickClient(item, "name", locale)}
                        {variant && item.menu_item_variants.length > 1 ? (
                          <span className="text-ink-muted"> · {pickClient(variant, "name", locale)}</span>
                        ) : null}
                        {addons.length ? (
                          <span className="block text-xs text-ink-muted">+ {addons.map((a) => pickClient(a, "name", locale)).join(", ")}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-ink">{formatPrice(unitPrice(l) * l.quantity, locale)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="−"
                        className="inline-flex size-7 items-center justify-center rounded-full border border-line hover:border-ink/40"
                        onClick={() => (l.quantity <= 1 ? removeLine(index) : updateLine(index, { quantity: l.quantity - 1 }))}
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-6 text-center tabular-nums" aria-label={t.manage.quantity}>
                        {l.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="+"
                        className="inline-flex size-7 items-center justify-center rounded-full border border-line hover:border-ink/40"
                        onClick={() => updateLine(index, { quantity: Math.min(20, l.quantity + 1) })}
                      >
                        <Plus className="size-3" />
                      </button>
                      <button
                        type="button"
                        aria-label={t.manage.remove}
                        className="ml-auto inline-flex size-7 items-center justify-center rounded-full text-ink-muted hover:text-danger"
                        onClick={() => removeLine(index)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <Input
                      aria-label={t.manage.itemNotes}
                      placeholder={t.manage.itemNotes}
                      maxLength={200}
                      value={l.notes}
                      onChange={(e) => updateLine(index, { notes: e.target.value })}
                      className="mt-2 h-8 text-xs"
                    />
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4 border-t border-line pt-4">
            <label htmlFor="order-notes" className="text-xs font-semibold text-ink-muted">
              {t.manage.orderNotes}
            </label>
            <Textarea
              id="order-notes"
              maxLength={500}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
              className="mt-1.5 min-h-16 text-sm"
            />
          </div>

          <p className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-sm text-ink-muted">{t.manage.total}</span>
            <span className="font-display text-2xl text-ink">{formatPrice(total, locale)}</span>
          </p>

          <Button type="button" className="mt-4 w-full" disabled={saving || (lines.length === 0 && initialLines.length === 0) || !dirty} onClick={() => save()}>
            {saving ? t.manage.saving : (
              <>
                <Check /> {t.manage.savePreorder}
              </>
            )}
          </Button>
          {initialLines.length > 0 ? (
            <Button type="button" variant="link" size="sm" className="mt-2 w-full text-ink-muted" disabled={saving} onClick={() => save(true)}>
              {t.manage.clear}
            </Button>
          ) : null}
          <p className="mt-3 text-center text-[0.7rem] text-ink-muted">{t.manage.preorderClosed}</p>
        </div>
      </aside>
    </div>
  );
}

function Configurator({ item, onAdd }: { item: MenuItem; onAdd: (line: CartLine) => void }) {
  const { locale, t } = useI18n();
  const defaultVariant = item.menu_item_variants.find((v) => v.is_default) ?? item.menu_item_variants[0];
  const [variantId, setVariantId] = useState<string | null>(defaultVariant?.id ?? null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="mt-4 rounded-sm border border-line bg-surface-2 p-4">
      {item.menu_item_variants.length > 1 ? (
        <fieldset>
          <legend className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{t.menu.options}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.menu_item_variants.map((v) => (
              <label
                key={v.id}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
                  variantId === v.id ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink",
                )}
              >
                <input type="radio" name={`variant-${item.id}`} className="sr-only" checked={variantId === v.id} onChange={() => setVariantId(v.id)} />
                {pickClient(v, "name", locale)}
                {Number(v.price_delta) > 0 ? ` +${formatPrice(Number(v.price_delta), locale)}` : ""}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {item.menu_item_addons.length > 0 ? (
        <fieldset className="mt-4">
          <legend className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{t.menu.addons}</legend>
          <div className="mt-2 space-y-1.5">
            {item.menu_item_addons.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm text-ink">
                <Checkbox
                  checked={addonIds.includes(a.id)}
                  onChange={(e) => setAddonIds((ids) => (e.target.checked ? [...ids, a.id] : ids.filter((x) => x !== a.id)))}
                />
                {pickClient(a, "name", locale)} <span className="text-ink-muted">+{formatPrice(Number(a.price), locale)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="−"
            className="inline-flex size-8 items-center justify-center rounded-full border border-line bg-surface"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            <Minus className="size-3" />
          </button>
          <span className="w-6 text-center tabular-nums">{quantity}</span>
          <button
            type="button"
            aria-label="+"
            className="inline-flex size-8 items-center justify-center rounded-full border border-line bg-surface"
            onClick={() => setQuantity((q) => Math.min(20, q + 1))}
          >
            <Plus className="size-3" />
          </button>
        </div>
        <Button type="button" size="sm" onClick={() => onAdd({ itemId: item.id, variantId, addonIds, quantity, notes: "" })}>
          <Plus /> {t.manage.add}
        </Button>
      </div>
    </div>
  );
}
