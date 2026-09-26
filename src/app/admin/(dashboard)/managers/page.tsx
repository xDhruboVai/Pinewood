import { ManagerManager, type ManagerHistoryRow, type ManagerRow } from "@/components/admin/manager-manager";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export const metadata = { title: "Managers" };

export default async function Page() {
  const me = await requireOwner();
  const admin = createAdminClient();
  const [{ data: users }, { data: profiles }, { data: branches }, { data: history }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("staff_profiles").select("user_id, full_name, role, branch_id, is_active").in("role", ["manager", "foh"]),
    admin.from("branches").select("id, name_en, name_bn, slug, is_active, sort_order").order("sort_order"),
    admin.from("manager_history").select("id, staff_user_id, full_name, event, branch_name, actor_user_id, created_at").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100),
  ]);

  const usersById = new Map((users?.users ?? []).map((user) => [user.id, user]));
  const rows: ManagerRow[] = (profiles ?? []).map((profile) => {
    const user = usersById.get(profile.user_id);
    return {
      ...profile,
      email: user?.email ?? "",
      lastSignIn: user?.last_sign_in_at ?? null,
      isMe: user?.id === me.userId,
    };
  });
  const historyRows: ManagerHistoryRow[] = (history ?? []).map((entry) => ({
    ...entry,
    actor_name: usersById.get(entry.actor_user_id ?? "")?.email ?? "System",
  }));

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-12">
      <div>
        <div>
          <p className="font-nav text-xs tracking-[0.18em] text-accent-ink uppercase">Admin</p>
          <h1 className="display mt-2 text-4xl text-ink">Managers</h1>
        </div>
      </div>
      <div className="mt-10"><ManagerManager rows={rows} branches={branches ?? []} history={historyRows} /></div>
    </div>
  );
}