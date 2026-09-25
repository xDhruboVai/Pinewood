// Frontend preview only (PW_PREVIEW=1): a sample branch set-up so the booking form can be tried per
// branch without Supabase. The area-to-branch assignments are made up for the preview and are NOT
// Pinewood's real rooms, tables or capacity. Never used in production builds.
import { OUTLETS } from "@/lib/site";
import type { Area, Branch } from "@/lib/types";
import sample from "./sample-data.json";

export const PREVIEW_BRANCHES: Branch[] = OUTLETS.map((o, i) => ({
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  slug: o.slug,
  name_en: o.name.en,
  name_bn: o.name.bn,
  is_active: true,
  sort_order: i + 1,
}));

// Every sample area is repeated in each branch (ids stay valid UUIDs), so each has inside and outside seats.
export const PREVIEW_AREAS: Area[] = PREVIEW_BRANCHES.flatMap((b, bi) =>
  (sample.areas as Area[]).map((a) => ({
    ...a,
    id: `${a.id.slice(0, 24)}${String(bi + 1).padStart(12, "0")}`,
    branch_id: b.id,
    seating: /outdoor|outside|rooftop|balcony|terrace|smok/i.test(`${a.slug} ${a.name_en}`) ? ("outside" as const) : ("inside" as const),
  })),
);
