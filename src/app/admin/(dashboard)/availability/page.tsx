import { PageHeader } from "@/components/admin/ui";
import { AvailabilityManager } from "@/components/admin/availability-manager";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dhakaDate } from "@/lib/format";
import type { Area, Blockout, DiningTable, HoursOverride, OpeningHours } from "@/lib/types";

export const metadata = { title: "Availability" };

export default async function AvailabilityPage() {
  const staff = await requireStaff();
  const supabase = await createClient();
  const today = dhakaDate();
  const since = new Date(Date.now() - 12 * 3600_000).toISOString();

  const [areas, tables, blockouts, overrides, hours] = await Promise.all([
    supabase.from("areas").select("*").order("sort_order"),
    supabase.from("dining_tables").select("*").order("label"),
    supabase.from("blockouts").select("*").gte("ends_at", since).order("starts_at"),
    supabase.from("hours_overrides").select("*").gte("ends_on", today).order("starts_on"),
    supabase.from("opening_hours").select("*").order("weekday"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Availability" description="Block seats for walk-ins or events, and manage seating areas and opening hours." />
      <AvailabilityManager
        isManager={staff.role === "manager"}
        today={today}
        areas={(areas.data ?? []) as Area[]}
        tables={(tables.data ?? []) as DiningTable[]}
        blockouts={(blockouts.data ?? []) as Blockout[]}
        overrides={(overrides.data ?? []) as HoursOverride[]}
        hours={(hours.data ?? []) as OpeningHours[]}
      />
    </div>
  );
}
