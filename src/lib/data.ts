import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS, PUBLIC_REVALIDATE } from "@/lib/cache-tags";
import { dhakaDate } from "@/lib/format";
import { createPublicClient } from "@/lib/supabase/server";
import type { Area, Branch, MenuCategory, OpeningHours, ScheduleDay } from "@/lib/types";

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

// Public reads (menu, hours, branches, areas) are the same for every visitor and change rarely, so
// they are kept in the Next data cache across requests instead of being read on every page view. Each
// is tagged (CACHE_TAGS) and expired by the admin action that changes it; PUBLIC_REVALIDATE covers
// edits made straight in Supabase. Errors are never cached. Live availability, holds and bookings
// are not in here: the booking form asks the database every time (get_availability, hold_slot).

async function loadMenu(branchId: string | null = null): Promise<MenuCategory[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("menu_categories").select(MENU_SELECT);
  if (error) throw error;
  const menu = sortMenu((data ?? []) as unknown as MenuCategory[]);
  if (!branchId) return menu;

  const { data: overrides, error: overrideError } = await supabase
    .from("menu_item_branch_overrides")
    .select("menu_item_id, price, is_available")
    .eq("branch_id", branchId);
  if (overrideError) throw overrideError;
  const overridesByItem = new Map((overrides ?? []).map((override) => [override.menu_item_id, override]));

  return menu.map((category) => ({
    ...category,
    menu_items: category.menu_items.map((item) => {
      const override = overridesByItem.get(item.id);
      return {
        ...item,
        global_price: item.price,
        global_is_available: item.is_available,
        price: override?.price == null ? item.price : Number(override.price),
        is_available: override?.is_available ?? item.is_available,
        price_overridden: override?.price != null,
        availability_overridden: override?.is_available != null,
      };
    }),
  }));
}

const cachedMenu = unstable_cache(loadMenu, ["menu"], { tags: [CACHE_TAGS.menu], revalidate: PUBLIC_REVALIDATE });

export const getMenu = cache((branchId: string | null = null): Promise<MenuCategory[]> => cachedMenu(branchId));

/** The menu straight from the database, for the admin menu screen (never cached). */
export const getMenuFresh = cache(() => loadMenu());

// These throw when the database can't be reached, like getMenu: the page then shows the branded
// error screen (app/(site)/error.tsx) instead of quietly rendering with no hours or no tables.
export const getAreas = cache(
  unstable_cache(
    async (): Promise<Area[]> => {
      const { data, error } = await createPublicClient().from("areas").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Area[];
    },
    ["areas"],
    { tags: [CACHE_TAGS.areas], revalidate: PUBLIC_REVALIDATE },
  ),
);

export const getBranches = cache(
  unstable_cache(
    async (): Promise<Branch[]> => {
      const { data, error } = await createPublicClient().from("branches").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return (data ?? []) as Branch[];
    },
    ["branches"],
    { tags: [CACHE_TAGS.branches], revalidate: PUBLIC_REVALIDATE },
  ),
);

// The schedule starts today, so today's Dhaka date is part of the cache key: after midnight the
// next request reads a new schedule instead of yesterday's.
const scheduleFrom = unstable_cache(
  async (days: number, branchId: string | null, _today: string): Promise<ScheduleDay[]> => {
    const { data, error } = await createPublicClient().rpc("get_schedule", branchId ? { p_days: days, p_branch: branchId } : { p_days: days });
    if (error) throw error;
    return (data ?? []) as ScheduleDay[];
  },
  ["schedule"],
  { tags: [CACHE_TAGS.hours], revalidate: PUBLIC_REVALIDATE },
);

/** Resolved hours for the next N days: one branch's own (branchId), or the hours every branch shares. */
export const getSchedule = cache((days = 14, branchId: string | null = null): Promise<ScheduleDay[]> => scheduleFrom(days, branchId, dhakaDate()));

/** Weekly hours: rows without a branch are shared by every branch; rows with one are that branch's own. */
export const getOpeningHours = cache(
  unstable_cache(
    async (): Promise<OpeningHours[]> => {
      const { data, error } = await createPublicClient().from("opening_hours").select("*").order("weekday");
      if (error) throw error;
      return (data ?? []) as OpeningHours[];
    },
    ["opening-hours"],
    { tags: [CACHE_TAGS.hours], revalidate: PUBLIC_REVALIDATE },
  ),
);
