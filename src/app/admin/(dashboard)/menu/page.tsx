import { AdminBody, PageHeader } from "@/components/admin/ui";
import { BranchMenuComparison } from "@/components/admin/branch-menu-comparison";
import { MenuManager } from "@/components/admin/menu-manager";
import { requireOwner } from "@/lib/auth";
import { getBranches, getMenuFresh, getMenu } from "@/lib/data";

export const metadata = { title: "Menu" };

export default async function AdminMenuPage() {
  await requireOwner();
  // The owner edits the global defaults; manager overrides remain branch-specific.
  const [menu, branches] = await Promise.all([getMenuFresh(), getBranches()]);
  const branchMenus = await Promise.all(branches.map(async (branch) => ({ branch, menu: await getMenu(branch.id) })));
  return (
    <>
      <PageHeader
        title="Menu"
        description="Take a dish off when it runs out, choose which dishes show on the home page, and change prices. New dishes, sizes and add-ons are added in Supabase."
      />
      <AdminBody>
        <MenuManager menu={menu} />
        <BranchMenuComparison menu={menu} branches={branchMenus} />
      </AdminBody>
    </>
  );
}
