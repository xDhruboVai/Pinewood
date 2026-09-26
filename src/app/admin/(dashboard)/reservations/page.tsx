import { AdminBody } from "@/components/admin/ui";
import { ReservationsBoard } from "@/components/admin/reservations-board";
import { requireStaff } from "@/lib/auth";
import { dhakaDate } from "@/lib/format";

export const metadata = { title: "Reservations" };

// The board draws its own header (title, date control and the day's numbers), so the page starts
// straight on the cream canvas under the staff navigation.
export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const staff = await requireStaff();
  const params = await searchParams;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : dhakaDate();

  return (
    <AdminBody>
      <ReservationsBoard initialDate={date} canDelete={staff.role === "manager"} />
    </AdminBody>
  );
}
