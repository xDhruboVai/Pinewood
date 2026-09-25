import { AdminBody, PageHeader } from "@/components/admin/ui";
import { ReservationsBoard } from "@/components/admin/reservations-board";
import { requireStaff } from "@/lib/auth";
import { dhakaDate } from "@/lib/format";

export const metadata = { title: "Reservations" };

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireStaff();
  const params = await searchParams;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : dhakaDate();

  return (
    <>
      <PageHeader title="Reservations" description="Call each new guest, then confirm or decline. Confirming sends them an email with a link to pre-order." />
      <AdminBody>
        <ReservationsBoard initialDate={date} />
      </AdminBody>
    </>
  );
}
