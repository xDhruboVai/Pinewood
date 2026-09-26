import { BranchStaffDirectory } from "@/components/admin/branch-staff-directory";
import { AdminBody, PageHeader } from "@/components/admin/ui";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import type { Branch, BranchStaff } from "@/lib/types";

export default async function Page() {
  await requireOwner();
  const admin = createAdminClient();
  const [{ data: branches, error: branchError }, { data: staff, error: staffError }] = await Promise.all([
    admin.from("branches").select("id, slug, name_en, name_bn, is_active, sort_order").order("sort_order"),
    admin.from("branch_staff").select("id, branch_id, full_name, job_title, email, phone, notes, is_active, updated_at").order("full_name"),
  ]);
  if (branchError) throw branchError;
  if (staffError) throw staffError;

  return (
    <>
      <PageHeader title="Staff by branch" description="Employee directory grouped by branch. Manager accounts and appointments are managed separately." />
      <AdminBody><BranchStaffDirectory branches={(branches ?? []) as Branch[]} staff={(staff ?? []) as BranchStaff[]} /></AdminBody>
    </>
  );
}
