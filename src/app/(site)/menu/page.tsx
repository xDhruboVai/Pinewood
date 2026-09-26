import type { Metadata } from "next";
import { MenuBrowser } from "@/components/site/menu-browser";
import { getBranches, getMenu } from "@/lib/data";
import { getI18n } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav.menu, description: t.menu.lede };
}

export default async function MenuPage() {
  const [{ t }, branches] = await Promise.all([getI18n(), getBranches()]);
  const [menu, branchMenus] = await Promise.all([
    getMenu(),
    Promise.all(branches.map(async (branch) => ({ branch, menu: await getMenu(branch.id) }))),
  ]);

  return (
    <>
      <section className="grain grain-dark bg-pine-700 text-cream-100">
        <div className="mx-auto max-w-7xl px-5 pt-12 pb-10 sm:px-8 sm:pt-16 lg:px-12">
          <p className="eyebrow !text-mustard-400">{t.menu.eyebrow}</p>
          <h1 className="script mt-3 pl-1.5 text-6xl lowercase sm:text-7xl lg:text-8xl">{t.menu.title}</h1>
          <p className="mt-4 max-w-xl leading-relaxed text-cream-100/75">{t.menu.lede}</p>
        </div>
      </section>
      <MenuBrowser menu={menu} branchMenus={branchMenus} />
    </>
  );
}
