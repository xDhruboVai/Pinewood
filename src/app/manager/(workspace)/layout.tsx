import { redirect } from "next/navigation";
import { ManagerNav } from "@/components/admin/manager-nav";
import { getStaff } from "@/lib/auth";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaff();
  if (!staff) redirect("/admin?next=%2Fmanager");
  if (staff.role !== "manager") redirect("/admin");

  return (
    <div className="min-h-dvh">
      <ManagerNav name={staff.fullName || staff.email} />
      <main>{children}</main>
    </div>
  );
}