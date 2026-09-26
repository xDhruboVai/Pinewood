import { AdminBody, PageHeader } from "@/components/admin/ui";
import { BranchStaffManager } from "@/components/admin/branch-staff-manager";
import { requireBranchManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import type { BranchStaff } from "@/lib/types";

export const metadata = { title: "Branch staff" };

export default async function BranchStaffPage() {
  const staff = await requireBranchManager();
  if (!staff.branchId) {
    return <PageHeader title="Branch staff" description="Your administrator needs to assign your branch before you can manage its staff." />;
  }

  const { data, error } = await createAdminClient()
    .from("branch_staff")
    .select("id, branch_id, full_name, job_title, email, phone, notes, is_active, updated_at")
    .eq("branch_id", staff.branchId)
    .order("is_active", { ascending: false })
    .order("full_name");
  if (error) throw error;

  return (
    <>
      <PageHeader title="Branch staff" description="Add employees, record their job titles and contact details, or deactivate a staff record." />
      <AdminBody><BranchStaffManager rows={(data ?? []) as BranchStaff[]} /></AdminBody>
    </>
  );
}