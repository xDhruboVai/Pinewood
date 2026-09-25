/**
 * Tags on the cached public reads in src/lib/data.ts. The admin actions that change this data expire
 * the matching tag (updateTag in src/actions/admin.ts), so the next page view reads the database.
 */
export const CACHE_TAGS = {
  menu: "menu",
  /** Weekly hours and special hours (opening_hours, hours_overrides), and so the schedule. */
  hours: "hours",
  areas: "areas",
  branches: "branches",
} as const;

/**
 * Seconds a cached read may be reused. The backstop for edits made straight in Supabase (new dishes,
 * a branch's areas or hours), which no admin action expires: they show within 5 minutes.
 */
export const PUBLIC_REVALIDATE = 300;
