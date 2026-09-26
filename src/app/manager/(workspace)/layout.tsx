import { redirect } from "next/navigation";
import { ManagerNav } from "@/components/admin/manager-nav";
import { requireStaff } from "@/lib/auth";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  if (staff.role !== "manager") redirect("/admin");

  return (
    <div className="min-h-dvh">
      <ManagerNav name={staff.fullName || staff.email} />
      <main>{children}</main>
    </div>
  );
}