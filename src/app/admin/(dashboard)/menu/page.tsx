import { PageHeader } from "@/components/admin/ui";
import { MenuManager } from "@/components/admin/menu-manager";
import { requireManager } from "@/lib/auth";
import { getMenu } from "@/lib/data";

export const metadata = { title: "Menu" };

export default async function AdminMenuPage() {
  await requireManager();
  const menu = await getMenu();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu"
        description="86 dishes instantly, feature signatures on the home page, and adjust prices. Variants, add-ons and new dishes live in Supabase → Table Editor."
      />
      <MenuManager menu={menu} />
    </div>
  );
}
