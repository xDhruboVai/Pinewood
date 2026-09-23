import { PageHeader } from "@/components/admin/ui";
import { StaffManager, type StaffRow } from "@/components/admin/staff-manager";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import type { StaffProfile } from "@/lib/types";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const me = await requireManager();
  const admin = createAdminClient();
  const [{ data: profiles }, { data: users }] = await Promise.all([
    admin.from("staff_profiles").select("*").order("created_at"),
    admin.auth.admin.listUsers({ perPage: 200 }),
  ]);

  const emailById = new Map((users?.users ?? []).map((u) => [u.id, { email: u.email ?? "", lastSignIn: u.last_sign_in_at ?? null }]));
  const rows: StaffRow[] = ((profiles ?? []) as StaffProfile[]).map((p) => ({
    ...p,
    email: emailById.get(p.user_id)?.email ?? "",
    lastSignIn: emailById.get(p.user_id)?.lastSignIn ?? null,
    isMe: p.user_id === me.userId,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Staff" description="Managers have full access. Front-of-house staff handle reservations, blockouts and the kitchen view." />
      <StaffManager rows={rows} />
    </div>
  );
}
