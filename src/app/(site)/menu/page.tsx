import type { Metadata } from "next";
import { PageHero } from "@/components/site/section";
import { MenuBrowser } from "@/components/site/menu-browser";
import { getMenu } from "@/lib/data";
import { getI18n } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav.menu, description: t.menu.lede };
}

export default async function MenuPage() {
  const { t } = await getI18n();
  const menu = await getMenu();

  return (
    <>
      <PageHero eyebrow={t.menu.eyebrow} title={t.menu.title} lede={t.menu.lede} />
      <MenuBrowser menu={menu} />
    </>
  );
}
