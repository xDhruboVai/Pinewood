import { AdminBody, PageHeader } from "@/components/admin/ui";
import { MenuManager } from "@/components/admin/menu-manager";
import { requireManager } from "@/lib/auth";
import { getMenu } from "@/lib/data";

export const metadata = { title: "Menu" };

export default async function AdminMenuPage() {
  await requireManager();
  const menu = await getMenu();
  return (
    <>
      <PageHeader
        title="Menu"
        description="Take a dish off when it runs out, choose which dishes show on the home page, and change prices. New dishes, sizes and add-ons are added in Supabase."
      />
      <AdminBody>
        <MenuManager menu={menu} />
      </AdminBody>
    </>
  );
}
