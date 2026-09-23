import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/server";
import type { Area, MenuCategory, MenuItem, OpeningHours, Review, ScheduleDay } from "@/lib/types";

const MENU_SELECT =
  "id, slug, section, name_en, name_bn, sort_order, menu_items(id, category_id, slug, name_en, name_bn, description_en, description_bn, price, image_url, tags, is_available, is_featured, sort_order, menu_item_variants(*), menu_item_addons(*))";

function sortMenu(categories: MenuCategory[]) {
  const sections = ["starters", "mains", "coffee", "desserts", "beverages"];
  return categories
    .sort((a, b) => sections.indexOf(a.section) - sections.indexOf(b.section) || a.sort_order - b.sort_order)
    .map((c) => ({
      ...c,
      menu_items: [...c.menu_items]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => ({
          ...i,
          price: Number(i.price),
          menu_item_variants: [...i.menu_item_variants].sort((a, b) => a.sort_order - b.sort_order),
          menu_item_addons: [...i.menu_item_addons].filter((a) => a.is_available).sort((a, b) => a.sort_order - b.sort_order),
        })),
    }));
}

export const getMenu = cache(async (): Promise<MenuCategory[]> => {
  const { data, error } = await createPublicClient().from("menu_categories").select(MENU_SELECT);
  if (error) throw error;
  return sortMenu((data ?? []) as unknown as MenuCategory[]);
});

export const getFeaturedItems = cache(async (): Promise<(MenuItem & { category_slug: string })[]> => {
  const menu = await getMenu();
  return menu.flatMap((c) => c.menu_items.filter((i) => i.is_featured).map((i) => ({ ...i, category_slug: c.slug })));
});

export const getReviews = cache(async (): Promise<Review[]> => {
  const { data } = await createPublicClient()
    .from("reviews")
    .select("id, author_name, author_context, rating, body_en, body_bn")
    .eq("is_published", true)
    .order("sort_order");
  return (data ?? []) as Review[];
});

export const getAreas = cache(async (): Promise<Area[]> => {
  const { data } = await createPublicClient().from("areas").select("*").order("sort_order");
  return (data ?? []) as Area[];
});

export const getSchedule = cache(async (days = 14): Promise<ScheduleDay[]> => {
  const { data } = await createPublicClient().rpc("get_schedule", { p_days: days });
  return (data ?? []) as ScheduleDay[];
});

export const getOpeningHours = cache(async (): Promise<OpeningHours[]> => {
  const { data } = await createPublicClient().from("opening_hours").select("*").order("weekday");
  return (data ?? []) as OpeningHours[];
});
