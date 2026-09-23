import { PageHeader } from "@/components/admin/ui";
import { KitchenBoard } from "@/components/admin/kitchen-board";
import { requireStaff } from "@/lib/auth";
import { dhakaDate } from "@/lib/format";

export const metadata = { title: "Kitchen" };

export default async function KitchenPage() {
  await requireStaff();
  return (
    <div className="space-y-6">
      <PageHeader title="Kitchen" description="Pre-ordered meals, timed to each table's arrival. Updates live." />
      <KitchenBoard initialDate={dhakaDate()} />
    </div>
  );
}
