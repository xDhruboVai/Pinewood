// Frontend preview only: stands in for src/lib/data.ts when the dev server runs with PW_PREVIEW=1
// (see next.config.ts), so the public pages render without Supabase.
// The sample data is generated from supabase/seed.sql. Nothing here is used in production.
import type { Area, MenuCategory, MenuItem, OpeningHours, Review, ScheduleDay } from "@/lib/types";
import sample from "./sample-data.json";

const SECTIONS = ["starters", "mains", "coffee", "desserts", "beverages"];

export async function getMenu(): Promise<MenuCategory[]> {
  return (sample.menu as unknown as MenuCategory[])
    .slice()
    .sort((a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || a.sort_order - b.sort_order);
}

export async function getFeaturedItems(): Promise<(MenuItem & { category_slug: string })[]> {
  const menu = await getMenu();
  return menu.flatMap((c) => c.menu_items.filter((i) => i.is_featured).map((i) => ({ ...i, category_slug: c.slug })));
}

export async function getReviews(): Promise<Review[]> {
  return sample.reviews as Review[];
}

export async function getAreas(): Promise<Area[]> {
  return sample.areas as Area[];
}

export async function getOpeningHours(): Promise<OpeningHours[]> {
  return sample.opening_hours as OpeningHours[];
}

/** Same shape as the get_schedule RPC: one row per day from today, times in Dhaka (UTC+6). */
export async function getSchedule(days = 14): Promise<ScheduleDay[]> {
  const today = new Date(Date.now() + 6 * 3600_000);
  return Array.from({ length: days }, (_, n) => {
    const d = new Date(today.getTime() + n * 86400_000);
    const day = d.toISOString().slice(0, 10);
    const hours = sample.opening_hours.find((h) => h.weekday === d.getUTCDay());
    return {
      day,
      opens: hours ? `${day}T${hours.opens_at}:00+06:00` : null,
      closes: hours ? `${day}T${hours.closes_at}:00+06:00` : null,
      label: null,
    };
  });
}
