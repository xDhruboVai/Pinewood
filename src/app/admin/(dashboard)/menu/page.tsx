import { AdminBody, PageHeader } from "@/components/admin/ui";
import { MenuManager } from "@/components/admin/menu-manager";
import { requireManager } from "@/lib/auth";
import { getMenuFresh } from "@/lib/data";

export const metadata = { title: "Menu" };

export default async function AdminMenuPage() {
  await requireManager();
  // Straight from the database: staff always see the current menu, not the public cached copy.
  const menu = await getMenuFresh();
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
