import { AdminBody, PageHeader } from "@/components/admin/ui";
import { KitchenBoard } from "@/components/admin/kitchen-board";
import { requireStaff } from "@/lib/auth";
import { dhakaDate } from "@/lib/format";

export const metadata = { title: "Kitchen" };

// Guests pre-order from the link in their confirmation email; this is where staff see those orders.
export default async function KitchenPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireStaff();
  const params = await searchParams;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : dhakaDate();

  return (
    <>
      <PageHeader title="Kitchen" description="Meals guests pre-ordered, timed to each table's arrival. Updates live." />
      <AdminBody>
        <KitchenBoard initialDate={date} />
      </AdminBody>
    </>
  );
}
