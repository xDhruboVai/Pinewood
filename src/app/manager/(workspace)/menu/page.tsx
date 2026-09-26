import { redirect } from "next/navigation";
import { AdminBody, PageHeader } from "@/components/admin/ui";
import { MenuManager } from "@/components/admin/menu-manager";
import { requireBranchManager } from "@/lib/auth";
import { getBranches, getMenu } from "@/lib/data";

export const metadata = { title: "Branch menu" };

export default async function BranchMenuPage() {
  const staff = await requireBranchManager();
  if (!staff.branchId) {
    return <PageHeader title="Branch menu" description="Your administrator needs to assign your branch before you can edit its menu." />;
  }

  const [branches, menu] = await Promise.all([getBranches(), getMenu(staff.branchId)]);
  const branch = branches.find((entry) => entry.id === staff.branchId);
  if (!branch) redirect("/manager/staff");

  return (
    <>
      <PageHeader title={`${branch.name_en} menu`} description="Changes here apply to this branch only. Values without an override use the admin’s global menu." />
      <AdminBody><MenuManager menu={menu} branchMode /></AdminBody>
    </>
  );
}