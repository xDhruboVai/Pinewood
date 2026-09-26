import { AdminBody, PageHeader } from "@/components/admin/ui";
import { ReservationsBoard } from "@/components/admin/reservations-board";
import { requireBranchManager } from "@/lib/auth";
import { dhakaDate } from "@/lib/format";

export const metadata = { title: "Reservations" };

export default async function ManagerReservationsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const staff = await requireBranchManager();
  if (!staff.branchId) {
    return <PageHeader title="Reservations" description="Your administrator needs to assign your branch before you can view reservations." />;
  }

  const params = await searchParams;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : dhakaDate();

  return (
    <AdminBody>
      <ReservationsBoard initialDate={date} canDelete />
    </AdminBody>
  );
}