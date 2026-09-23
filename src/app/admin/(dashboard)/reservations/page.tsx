import { PageHeader } from "@/components/admin/ui";
import { ReservationsBoard } from "@/components/admin/reservations-board";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dhakaDate } from "@/lib/format";
import type { Area, DiningTable } from "@/lib/types";

export const metadata = { title: "Reservations" };

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ date?: string; status?: string }> }) {
  await requireStaff();
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: areas }, { data: tables }] = await Promise.all([
    supabase.from("areas").select("*").order("sort_order"),
    supabase.from("dining_tables").select("*").order("label"),
  ]);
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : dhakaDate();

  return (
    <div className="space-y-6">
      <PageHeader title="Reservations" description="Call pending guests, confirm to send their email and pre-order link." />
      <ReservationsBoard
        initialDate={date}
        initialFilter={params.status === "pending" ? "pending" : "all"}
        areas={(areas ?? []) as Area[]}
        tables={(tables ?? []) as DiningTable[]}
      />
    </div>
  );
}
