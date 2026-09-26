import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/types";

export interface StaffSession {
  userId: string;
  email: string;
  fullName: string;
  role: StaffRole;
  branchId: string | null;
}

export const getStaff = cache(async (): Promise<StaffSession | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("full_name, role, branch_id, is_active")
    .eq("user_id", claims.sub)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;
  return {
    userId: claims.sub,
    email: (claims.email as string | undefined) ?? "",
    fullName: profile.full_name,
    role: profile.role as StaffRole,
    branchId: profile.branch_id ?? null,
  };
});

export async function requireStaff() {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login?error=not_staff");
  return staff;
}

export async function requireManager() {
  const staff = await requireStaff();
  if (staff.role !== "manager" && staff.role !== "owner") redirect("/admin?error=forbidden");
  return staff;
}

export async function requireBranchManager() {
  const staff = await requireStaff();
  if (staff.role !== "manager") redirect("/admin?error=forbidden");
  return staff;
}

export async function requireOwner() {
  const staff = await requireStaff();
  if (staff.role !== "owner") redirect("/admin?error=forbidden");
  return staff;
}
