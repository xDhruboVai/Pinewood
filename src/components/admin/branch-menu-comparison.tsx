import { formatPrice } from "@/lib/format";
import type { Branch, MenuCategory, MenuItem } from "@/lib/types";

type BranchMenu = { branch: Branch; menu: MenuCategory[] };

function flatten(menu: MenuCategory[]) {
  return new Map(menu.flatMap((category) => category.menu_items.map((item) => [item.id, item] as const)));
}

function Availability({ available }: { available: boolean }) {
  return <span className={available ? "text-forest-700" : "text-danger"}>{available ? "Available" : "Off"}</span>;
}

function effective(item: MenuItem) {
  return { price: Number(item.price), available: item.is_available };
}

export function BranchMenuComparison({ menu, branches }: { menu: MenuCategory[]; branches: BranchMenu[] }) {
  const items = menu.flatMap((category) => category.menu_items.map((item) => ({ category: category.name_en, item })));
  const branchItems = branches.map((branch) => ({ ...branch, items: flatten(branch.menu) }));

  return (
    <section className="mt-16">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
        <div>
          <h2 className="display text-3xl text-ink">Branch comparison</h2>
          <p className="mt-1 text-sm text-ink-muted">Current effective price and availability, including branch overrides.</p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-1 text-left text-sm">
          <thead className="text-xs text-ink-muted">
            <tr>
              <th className="sticky left-0 bg-canvas px-3 py-2 font-normal">Dish</th>
              <th className="min-w-36 px-3 py-2 font-normal">Global default</th>
              {branches.map(({ branch }) => <th key={branch.id} className="min-w-40 px-3 py-2 font-normal">{branch.name_en}</th>)}
            </tr>
          </thead>
          <tbody>
            {items.map(({ category, item }) => (
              <tr key={item.id} className="bg-surface">
                <th scope="row" className="sticky left-0 min-w-48 bg-surface px-3 py-2.5 text-left font-medium text-ink">
                  <span>{item.name_en}</span>
                  <span className="block text-xs font-normal text-ink-muted">{category}</span>
                </th>
                <td className="px-3 py-2.5">
                  <p className="tabular-nums text-ink">{formatPrice(Number(item.global_price ?? item.price), "en")}</p>
                  <Availability available={item.global_is_available ?? item.is_available} />
                </td>
                {branchItems.map(({ branch, items: branchMenu }) => {
                  const branchItem = branchMenu.get(item.id);
                  const value = branchItem ? effective(branchItem) : { price: Number(item.global_price ?? item.price), available: item.global_is_available ?? item.is_available };
                  const differs = value.price !== Number(item.global_price ?? item.price) || value.available !== (item.global_is_available ?? item.is_available);
                  return (
                    <td key={branch.id} className="px-3 py-2.5">
                      <p className="tabular-nums text-ink">{formatPrice(value.price, "en")} {differs ? <span className="text-xs text-accent-ink">Override</span> : null}</p>
                      <Availability available={value.available} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}